// Built-in Node.js modules
let path = require('path');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');

let app = express();
let port = 8000;

let public_dir = path.join(__dirname, 'public');
let template_dir = path.join(__dirname, 'templates');
let db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

// open stpaul_crime.sqlite3 database
// data source: https://information.stpaul.gov/Public-Safety/Crime-Incident-Report-Dataset/gppb-g9cg
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir));


// REST API: GET /codes
// Respond with list of codes and their corresponding incident type
app.get('/codes', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    let inputA = querystring.parse(url.searchParams.toString());
    let input = url.search.toString();
    let codeValues = input.slice(6, input.length);
    var array = codeValues.split(',');

    if(input.indexOf("?") >= 0)
    {
        var result = [];

        databaseSelect('SELECT code, incident_type as type FROM Codes')
        .then((rows) => {
            for(i = 0; i<array.length; i++){
                for(j=0; j<rows.length; j++){
                    if(array[i]== rows[j].code){
                        result.push(rows[j]);
                    }
                }
            }
            res.status(200).type('json').send(result);     
        }).catch((error)=> {
            console.log("error");
        });   
    }

    else{
        databaseSelect('SELECT code, incident_type as type FROM Codes')
        .then((rows) => {
            res.status(200).type('json').send(rows);     
        }).catch((error)=> {
            console.log("error");
        });
    }
});

// REST API: GET /neighborhoods
// Respond with list of neighborhood ids and their corresponding neighborhood name
app.get('/neighborhoods', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);

    res.status(200).type('json').send({});
});

// REST API: GET/incidents
// Respond with list of crime incidents
app.get('/incidents', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
	let search = url.searchParams

	let query = "SELECT * from Incidents ${where} ORDER BY date_time DESC LIMIT ?"
	let wheres = []
	let params = []
	let limit = 1000

	let prepareIn = function(sql,query) {
		// performs prepared statement work for 'WHERE var IN (p, q, ...)'
		let stmt = sql + ' IN (?)'
		let values = search.get(query).split(',')

		let q = ''
		for(x of values) {
			q = q + ',?'
			params.push(x)
		}
		q=q.substring(1)
		wheres.push(stmt.replace('?',q))
	}

	if(search.has('start_date')) {
		wheres.push('date_time > ?')
		params.push(search.get('start_date'))
	}

	if(search.has('end_date')) {
		wheres.push('date_time <= ?')
		params.push(search.get('end_date') + 'T23:59:59')
	}

	if(search.has('code')) {
		prepareIn('code','code')
	}

	if(search.has('grid')) {
		prepareIn('police_grid','grid')
	}

	if(search.has('neighborhood')) {
		prepareIn('neighborhood_number','neighborhood')
	}

	if(search.has('limit')) {
		limit = search.get('limit')
	}

	// assemble WHERE statement
	let whereString = '' // initialized empty in case there are no conditions

	if(wheres.length > 0) {
		whereString = 'WHERE '

		for(i of wheres) {
			whereString = whereString.concat(i, ' AND ')
		}
		whereString = whereString.substring(0,whereString.lastIndexOf('AND')-1) // strips trailing AND
	}

	// finalize query
	query = query.replace("${where}",whereString)
	params.push(limit)

	console.log(query)
	databaseSelect(query,params).then((data) => {
		for(x of data) { // splits date and time into two attributes
			let date_time = x.date_time.split('T')
			x.date = date_time[0]
			x.time = date_time[1]
			delete x.date_time
		}
		res.status(200).type('json').send(data)
	}).catch((err) => {
		res.status(500).type('text').send('500: ' + err)
	})
});

// REST API: PUT /new-incident
// Respond with 'success' or 'error'
app.put('/new-incident', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);

    res.status(200).type('txt').send('success');
});


// Create Promise for SQLite3 database SELECT query
function databaseSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        })
    })
}

// Create Promise for SQLite3 database INSERT query
function databaseInsert(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}


// Start server
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
