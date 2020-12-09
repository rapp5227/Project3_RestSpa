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
    let input = url.search.toString();
    let codeValues = input.slice(6, input.length);
    var array = codeValues.split(',');
    let query = 'SELECT code, incident_type as type FROM Codes ORDER BY code';

    if(input.indexOf("?") >= 0)
    {
        var result = [];

        databaseSelect(query)
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
            res.status(500).type('text').send('500: ' + error)
        });   
    }

    else{
        databaseSelect(query)
        .then((rows) => {
            res.status(200).type('json').send(rows);     
        }).catch((error)=> {
            res.status(500).type('text').send('500: ' + error)
        });
    }
});

// REST API: GET /neighborhoods
// Respond with list of neighborhood ids and their corresponding neighborhood name
app.get('/neighborhoods', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    let input = url.search.toString();
    let neighborhood = input.slice(4, input.length);
    var array = neighborhood.split(',');
    let query = 'SELECT  neighborhood_number as id, neighborhood_name as name FROM Neighborhoods ORDER BY neighborhood_number';

    if(input.indexOf("?") >= 0)
    {
        var result = [];

        databaseSelect(query)
        .then((rows) => {
            for(i = 0; i<array.length; i++){
                for(j=0; j<rows.length; j++){
                    if(array[i]== rows[j].id){
                        result.push(rows[j]);
                    }
                }
            }
            res.status(200).type('json').send(result);     
        }).catch((error)=> {
            res.status(500).type('text').send('500: ' + error)
        });   
    }

    else{
        databaseSelect(query)
        .then((rows) => {
            res.status(200).type('json').send(rows);     
        }).catch((error)=> {
            res.status(500).type('text').send('500: ' + error)
        });
    }
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

	let prepareIn = function(variable,list) {
		// performs prepared statement work for 'WHERE var IN (p, q, ...)'
		let stmt = variable + ' IN (?)'
		let values = search.get(list).split(',')

		let q = ''
		for(x of values) {
			q = q + ',?'
			params.push(x)
		}
		wheres.push(stmt.replace('?',q.substring(1)))
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
    var case_number;
    var date;
    var time;
    var code;
    var incident;
    var police_grid;
    var neighborhood_number;
    var block;
    let param = [];
    let input = url.searchParams;
    let query = 'INSERT INTO Incidents(case_number,date_time,code,incident,police_grid,neighborhood_number,block) VALUES (?,?,?,?,?,?,?)';
    

    if(input.has('case_number')){
        case_number = parseInt(input.get('case_number'));
        param.push(case_number);
    }
    if(input.has('date') && input.has('time')){
        date = input.get('date');
        time = input.get('time');
        param.push(date+'T'+time);
    }
    if(input.has('code')){
        code = parseInt(input.get('code'));
        param.push(code);
    }
    if(input.has('incident')){
        incident = input.get('incident')
        param.push(incident);
    }
    if(input.has('police_grid')){
        police_grid = parseInt(input.get('police_grid'));
        param.push(police_grid);
    }
    if(input.has('neighborhood_number')){
        neighborhood_number = parseInt(input.get('neighborhood_number'));
        param.push(neighborhood_number);
    }
    if(input.has('block')){
        block = input.get('block')
        param.push(block);
    }

    databaseInsert(query, param)
    .then(()=>{
        res.status(200).type('txt').send('success');
    }).catch((error)=> {
        //We didn't create a separate SELECT check for the PUT because SQL automatically prevents users from entering similar id for primary keys (which is case_number in this case)
        res.status(500).type('text').send('500: ' + error)
    });
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
