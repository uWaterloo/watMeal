// Create tables
// CREATE TABLE keys(id INTEGER PRIMARY KEY IDENTITY(1,1), value nvarchar(50), name nvarchar(50))
// CREATE TABLE credentials(id INTEGER PRIMARY KEY IDENTITY(1,1), value nvarchar(100), name nvarchar(50), userId nvarchar(50))


// Run once to create encryption keys

/*
function createKeys(){
	var authKey = Encryption.MakeKey();
  	var cryptKey = Encryption.MakeKey();
  	
  	db.Execute("INSERT INTO keys VALUES(N'"+authKey+"','authKey')");
  	db.Execute("INSERT INTO keys VALUES(N'"+cryptKey+"','cryptKey')");
  
  	return '{"debug":"inserted keys"}';
}
*/

function getCredentials(){  
  	SetEncryptionSettings();
  	var queryResult = JSON.parse(db.Execute('SELECT value, name FROM credentials WHERE userId=@currentUser'));
  	if(queryResult.length==0)
      return '[{"value":"","name":"Pass"},{"value":"' + user.Student.StudentNumber + '","name":"uwId"}]';
    else{
      for(var i in queryResult)
      {
      	var row = queryResult[i];
        if(row.name=="Pass")
          row.value = Encryption.Decrypt(row.value);
      }
      return JSON.stringify(queryResult);
    }
}


function saveCredentials(){
  	// Can't save if credentials already exist
  	//var queryResult = JSON.parse(db.Execute('SELECT value, name FROM credentials WHERE userId=@currentUser'));
  	//if(queryResult.length!=0)
    //  return '{"debug":"credentials already exist"}';

    db.Execute('DELETE FROM credentials WHERE userId=@currentUser');

  
  SetEncryptionSettings();
  	var encryptedPass = Encryption.Encrypt(args.Get("pass"));	
  	db.Declare('encryptedPass',encryptedPass,true);
	db.Execute("INSERT INTO credentials VALUES(@encryptedPass,'Pass',@currentUser)");
  	db.Execute('INSERT INTO credentials VALUES(@myUwId,"uwId",@currentUser)');
  
    // Make sure that two records for the user exist, if no, delete what's there
  	var queryResult = JSON.parse(db.Execute('SELECT value, name FROM credentials WHERE userId=@currentUser'));
  	if (queryResult.length != 2)
  	    db.Execute('DELETE FROM credentials WHERE userId=@currentUser');

  	return '{"debug":"inserted credentials"}';
    
}

function SetEncryptionSettings(){
	var authKey = JSON.parse(db.Execute('SELECT value FROM keys WHERE name="authKey"'))[0].value;
  	var cryptKey = JSON.parse(db.Execute('SELECT value FROM keys WHERE name="cryptKey"'))[0].value;
  	Encryption.SetAuthKey(authKey);
  	Encryption.SetCryptKey(cryptKey);
}

function logout(){
	return db.Execute('DELETE FROM credentials WHERE userId=@currentUser');
}