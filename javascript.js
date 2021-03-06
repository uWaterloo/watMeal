angular.module('portalApp')

.controller('watMealCtrl', ['$scope', 'watcardFactory', function($scope, watcardFactory) {
    // Run once
    //$scope.portalHelpers.invokeServerFunction('createKeys');

    $scope.portalHelpers.config = {
        "widgetMenu": "widgetMenu.html"
    };

    $scope.uwid = watcardFactory.uwid;
    $scope.pass = watcardFactory.pass;
    $scope.watcard = watcardFactory.watcard; // Stores model for the view
    $scope.loggedIn = watcardFactory.loggedIn; // Indicates user is logged in
    $scope.err = watcardFactory.err; // Indicates a login error has occured
    $scope.loading = watcardFactory.loading;
    $scope.saveCredentials = watcardFactory.saveCredentials;
    $scope.fromButton = false;
    $scope.dailybudget = watcardFactory.dailybudget;

    $scope.$watch('loading.value', function() {

        if ($scope.loading.value) {
            $scope.portalHelpers.toggleLoading(true);
            $scope.portalHelpers.showView('loading.html', 1, false);
        } else {
            if (!$scope.loggedIn.value) {
                $scope.portalHelpers.showView('notLoggedIn.html', 1);
            } else {
                $scope.portalHelpers.showView('main.html', 1);
            }
        }

        if (!$scope.loading.value)
            $scope.portalHelpers.toggleLoading(false);
    });

    watcardFactory.init($scope);
    $scope.$on('refresh', function() {
        watcardFactory.initialized.value = false;
    });

    // attempt login
    $scope.login = function() {

        $scope.fromButton = true;
        if ($scope.uwid.value == "" || $scope.pass.value == "") {
            $scope.err.value = true;
            return;
        }
        $scope.err.value = false;
        $scope.saveCredentials.value = true; // Save credentials to db if login is successful
        $scope.loading.value = true;
        watcardFactory.getWatcardInfo($scope);
    }

    // logout - erase credentials on the server
    $scope.logout = function() {
        $scope.err.value = false;
        $scope.portalHelpers.toggleLoading(true);
        $scope.portalHelpers.showView('loading.html', 1, false);

        $scope.portalHelpers.invokeServerFunction('logout').then(function() {
            $scope.loggedIn.value = false;
            $scope.loading.value = false;
            $scope.pass.value = "";

            $scope.portalHelpers.showView('notLoggedIn.html', 1);
            $scope.portalHelpers.toggleLoading(false);
        });
    }

}])

.factory('watcardFactory', ['$http', '$rootScope', function($http, $rootScope) {

    var l = 2; // Counter for data sources, used to sync 2 data calls
    var saveCredentials = {
        value: false
    }; // Save credentials if able to get data

    var uwid = {
        value: ""
    };
    var pass = {
        value: ""
    };
    var watcard = {}; // Stores model for the view
    var loggedIn = {
        value: false
    }; // Indicates user is logged in
    var err = {
        value: false
    }; // Indicates a login error has occured
    var loading = {
        value: false
    };
    var initialized = {
        value: false
    };

    var dailybudget = {
        value: 0
    };

    var init = function($scope) {



        if (initialized.value) {
            $rootScope.$broadcast('widgetReady', 'watcard');
            return;
        }

        initialized.value = true;
        loading.value = true;
        $rootScope.$broadcast('widgetReady', 'watcard');

        // See if user has credentials saved into db
        $scope.portalHelpers.invokeServerFunction('getCredentials').then(function(data) {


            for (var i in data) {
                var row = data[i];
                if (row.name == "Pass")
                // no credentials - show login page with pre-filled uwId
                    if (row.value == "") {
                        loggedIn.value = false;
                        loading.value = false;
                    } else
                        pass.value = row.value;
                else if (row.name == "uwId")
                    uwid.value = row.value;
            }

            // Credentials exist, attempt to fetch data
            if (pass.value != "") {
                getWatcardInfo($scope);
            }
        });
    };
    var getWatcardInfo = function($scope) {
        getWatcardBalance($scope);

    };
    var getWatcardHistory = function($scope) {
        watcard.LastRecentTransactionAmount = 0;
        watcard.LastRecentTransactionDate = "";
        var endDate = moment().tz("America/Toronto").format("M/D/YYYY");
        var startDate = moment().subtract(7, 'day').tz("America/Toronto").format("M/D/YYYY");
        // moment().subtract(4, 'month').tz("America/Toronto").format("M/D/YYYY");



        // Set post parameters
        var postParams = {
            acnt_1: uwid.value,
            acnt_2: pass.value,
            DBDATE: startDate,
            DEDATE: endDate,
            watgopher_title: "WatCard+History+Report",
            watgopher_regex: "%3Chr%3E%28%5B%5Cs%5CS%5D*wrong%5B%5Cs%5CS%5D*%29%3Cp%3E%3C%2Fp%3E%7C%28%3Cform%5B%5Cs%5CS%5D*%3F%28%3C%2Fcenter%3E%7C%3C%2Fform%3E%29%29%7C%28%3Cpre%3E%3Cp%3E%5B%5Cs%5CS%5D*%3C%2Fpre%3E%29",
            PASS: "PASS",
            watgopher_style: "onecard_narrow",
            STATUS: "HIST"
        };

        // Get the page
        $http.post("/Develop/PostProxy", {
            values: postParams,
            url: "https://account.watcard.uwaterloo.ca/watgopher661.asp"
        }).success(function(response) {


            var doc = document.implementation.createHTMLDocument("");
            doc.documentElement.innerHTML = response;

            jq = $(doc);

            // Check for login error
            if (jq.find('#oneweb_message_invalid_login').length == 0) {

                // Scrape out data

                // Check if any history records exist
                if (jq.find('#oneweb_message_financial_history').length != 0)
                    watcard.LastRecentTransactionExists = false;
                else {

                    var amount = 0
                    var row = 0;
                    var current = 0;
                    var date;
                    var weekcurr;
                    var weektotal = 0;

                    var currdate = moment().tz("America/Toronto").format("MM/D/YYYY");
                    var len = jq.find('#oneweb_financial_history_table tr').length;
                    for (var i = 2; i < len; i++) {
                        row = jq.find('#oneweb_financial_history_table tr').eq(i);
                        date = row.find('#oneweb_financial_history_td_date').text();
                        if (date == currdate) {
                            current = parseFloat(row.find('#oneweb_financial_history_td_amount').text());
                            amount += Math.abs(current);
                        }
                        weektotal += Math.abs(parseFloat(row.find('#oneweb_financial_history_td_amount').text()));
                    }

                    var time = row.find('#oneweb_financial_history_td_time').text();
					
                    watcard.WeekTot = weektotal;
                    watcard.LastRecentTransactionAmount = amount;
                    watcard.LastRecentTransactionDate = moment(date + " " + time, 'MM/DD/YYYY hh:mm:ss');
                    watcard.LastRecentTransactionExists = true;
                }
            } else {
                watcard.LastRecentTransactionExists = false;
                err.value = true;
            }
            
            // Ghetto way to approx last date.
            var today = new Date();
            var lastday;
            if ((0 <= today.getMonth()) && (today.getMonth() < 4)) {
                lastday = new Date(today.getFullYear(), 3, 23);
            } else if ((4 <= today.getMonth()) && (today.getMonth() < 8)) {
                lastday = new Date(today.getFullYear(), 7, 23);
            } else {
                lastday = new Date(today.getFullYear(), 11, 23);
            }

            var daysleft = Math.abs(Math.floor((lastday - today) / (24 * 60 * 60 * 1000)));

            if (daysleft == 0) {
                daysleft = 1;
            }
            watcard.value = (watcard.MeanPlanBalance) / daysleft;
            
            watcard.continue = watcard.MeanPlanBalance - daysleft*amount;
            
            watcard.suggestweek = (2*(watcard.MeanPlanBalance) /daysleft)*7;
            sourceLoaded($scope);
        });
    }
    var getWatcardBalance = function($scope) {
        var postParams = {
            acnt_1: uwid.value,
            acnt_2: pass.value,
            watgopher_title: "WatCard+Account+Status",
            watgopher_regex: "%2F%3Chr%3E%28%5B%5Cs%5CS%5D*%29%3Chr%3E%2F%3B+%2F%3E%0D%0A++%3Cinput+type%3D",
            FINDATAREP: "ON",
            MESSAGEREP: "ON",
            STATUS: "STATUS"
        };
        $http.post("/Develop/PostProxy", {
            values: postParams,
            url: 'https://account.watcard.uwaterloo.ca/watgopher661.asp'
        }).success(function(response) {
            var doc = document.implementation.createHTMLDocument("");
            doc.documentElement.innerHTML = response;
            getWatcardHistory($scope);
            jq = $(doc);

            // Check for login error
            if (jq.find('#oneweb_balance_information_table #oneweb_balance_information_td_amount').length != 0) {

                var balanceObjects = jq.find('#oneweb_balance_information_table #oneweb_balance_information_td_amount');
                var flexBalance = 0;
                var mealBalance = 0;
                var i = 0;
                balanceObjects.each(function() {
                    if (i < 9) {
                        var text = $(this).text().trim();
                        while (text.indexOf(',') > -1) {
                            text = text.replace(',', '');
                        }
                        var parsed = parseFloat(text);

                        if (i >= 3 && i <= 5)
                            flexBalance += parsed;
                        else
                            mealBalance += parsed;
                    }
                    i++;
                });

                if (!isNaN(flexBalance))
                    watcard.FlexBalance = flexBalance;

                if (!isNaN(mealBalance))
                    watcard.MeanPlanBalance = mealBalance*2;
                watcard.EBalance = mealBalance * 2;

            } else {

                err.value = true;
            }

            sourceLoaded($scope);
        });
    }
    var sourceLoaded = function($scope) {

        l--;
        if (l == 0) {
            // If both sources were loaded
            l = 2;
            loading.value = false;
            if (!err.value) {
                // If no login error, show main view
                loggedIn.value = true;
                // Save credentials to db if this was invoked from the login view
                if (saveCredentials.value) {

                    $scope.portalHelpers.invokeServerFunction('saveCredentials', {
                        pass: pass.value,
                        myUwId: uwid.value
                    }).then(function(r) {});
                    saveCredentials.value = false;
                }
            } else {
                // Error occured - show login form with an error
                pass.value = "";
            }
            $scope.$emit('masonry.reload');
        }
    }

    return {
        init: init,
        getWatcardInfo: getWatcardInfo,
        getWatcardHistory: getWatcardHistory,
        getWatcardBalance: getWatcardBalance,
        sourceLoaded: sourceLoaded,
        uwid: uwid,
        pass: pass,
        watcard: watcard,
        loggedIn: loggedIn,
        err: err,
        loading: loading,
        saveCredentials: saveCredentials,
        initialized: initialized
    }
}]);