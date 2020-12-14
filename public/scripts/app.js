let app;
let map;
let neighborhood_markers =
[
    {location: [44.942068, -93.020521], marker: null, count: 0},
    {location: [44.977413, -93.025156], marker: null, count: 0},
    {location: [44.931244, -93.079578], marker: null, count: 0},
    {location: [44.956192, -93.060189], marker: null, count: 0},
    {location: [44.978883, -93.068163], marker: null, count: 0},
    {location: [44.975766, -93.113887], marker: null, count: 0},
    {location: [44.959639, -93.121271], marker: null, count: 0},
    {location: [44.947700, -93.128505], marker: null, count: 0},
    {location: [44.930276, -93.119911], marker: null, count: 0},
    {location: [44.982752, -93.147910], marker: null, count: 0},
    {location: [44.963631, -93.167548], marker: null, count: 0},
    {location: [44.973971, -93.197965], marker: null, count: 0},
    {location: [44.949043, -93.178261], marker: null, count: 0},
    {location: [44.934848, -93.176736], marker: null, count: 0},
    {location: [44.913106, -93.170779], marker: null, count: 0},
    {location: [44.937705, -93.136997], marker: null, count: 0},
    {location: [44.949203, -93.093739], marker: null, count: 0}
];



function init() {
    let crime_url = 'http://localhost:8000';

    app = new Vue({
        el: '#app',
        data: {
            map: {
                center: {
                    lat: 44.955139,
                    lng: -93.102222,
                    address: ""
                },
                zoom: 12,
                bounds: {
                    nw: {lat: 45.008206, lng: -93.217977},
                    se: {lat: 44.883658, lng: -92.993787}
                }
			},
			search: {
				go: () => {
                    go(this.value)
                },
				placeholder: "Search",
                value: ""
			},
            crimes: [],
            filteredCrimes: [],
            showIncidents: [],
            incidents: []
		}
    });

    getJSON('http://localhost:8000/codes').then(rows => {

        for(let i = 0; i < rows.length; i++)
        {
            app.incidents.push(rows[i].type);
        }
    });

    map = L.map('leafletmap').setView([app.map.center.lat, app.map.center.lng], app.map.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 11,
        maxZoom: 18
    }).addTo(map);
    map.setMaxBounds([[44.883658, -93.217977], [45.008206, -92.993787]]);
	map.on('moveend',(event) => {
		console.log('map update')
		updateCrimeTable(10) // TODO final version needs to be 1000
	})

    let district_boundary = new L.geoJson();
    district_boundary.addTo(map);

    getJSON('data/StPaulDistrictCouncil.geojson').then((result) => {
        // St. Paul GeoJSON
        $(result.features).each(function(key, value) {
            district_boundary.addData(value);
        });
    }).catch((error) => {
        console.log('Error:', error);
	});

	neighborhoodMarkers()
	updateCrimeTable(10) //TODO change the limit param here to 1000 before turning in
}

function getJSON(url) {
    return new Promise((resolve, reject) => {
        $.ajax({
            dataType: "json",
            url: url,
            success: function(data) {
                resolve(data);
            },
            error: function(status, message) {
                reject({status: status.status, message: status.statusText});
            }
        });
    });
}

function go(value) {
    //TODO this function runs when the search entry is submitted
    // if value is address -> convert

}

function getLatLng(address){
    let api = 'https://nominatim.openstreetmap.org/search?format=json&country=United States&state=MN&city=St. Paul&street='+address;
    return $.getJSON(api);
}


function addressSearch(){
//     console.log('addressSearch');
//    console.log(app.map.center.address);
    getLatLng(app.map.address)
        .then(data => {
//             console.log(data);
//             console.log(data[0].lat);
//             console.log(data[0].lon);

            if(data.length > 0) {
                app.map.center.lat = data[0].lat;
                app.map.center.lng = data[0].lon;
                app.map.zoom = 17;
                map.setZoom(app.map.zoom); //set zoom for address search
				map.panTo([app.map.center.lat, app.map.center.lng]); //pan to coordinates

				updateCrimeTable(10) // TODO update to 1000
            } else {
                alert("Address '"+app.map.address+"' not found")
            }
        }).catch(error => {
            console.log(error);
        });
}

function updateCrimeTable(limit) {
//TODO needs to update whenever the map changes
//TODO currently filters on neighborhood visibility, but not on whether a specific incident is visible yet

    let requestString = 'http://localhost:8000/incidents?neighborhood=' + visibleNeighborhoods().join(',')

	if(limit) { // adds limit parameter, if specified
		requestString += '&limit=' + limit
	}

	getJSON(requestString).then(rows => {
		let promises = new Array(rows.length)

		for(let i = 0;i < rows.length;i++) {
			promises[i] = new Promise((resolve,reject) => {
				Promise.all([getJSON('http://localhost:8000/codes?code=' + rows[i].code),getJSON('http://localhost:8000/neighborhoods?id=' + rows[i].neighborhood_number)])
					.then(data => {
						resolve({
							date: rows[i].date,
							time: rows[i].time,
							neighborhood: data[1][0].name,
							address: rows[i].block,
							incident: data[0][0].type,
							style: {
								backgroundColor: tableRowColor(rows[i].code)
                            }
						})
					})
			})
		}

		Promise.all(promises).then(data => {
            app.crimes = [].concat(data) // concat is used to make sure the table is re-rendered
            for(crime in app.crimes)
            {
                if(app.showIncidents.indexOf(crime.incident) > -1)
                {
                    app.filteredCrimes.push(app.crime);
                }
            }
            console.log(app.filteredCrimes);
		})
	})
}

function tableRowColor(code) {
	// returns the table row color for the given incident code

	// violent crimes: red
	// property crimes: green
	//drug crimes: blue
	//other: white

	if (code < 500) { // murders, rapes, robberies, ag. assaults,
		return 'red'
	} else if (code >= 500 && code < 810 && code !== 614) { // burglaries, thefts, motor vehicle thefts
		return 'green'
	} else if (code >= 810 && code < 900) { // domestic assaults
		return 'red'
	} else if (code >= 900 && code < 1800) { // arson, property damage, graffiti
		return 'green'
	} else if (code >= 1800 && code < 2619) { // narcotics
		return 'blue'
	} else { // other, discharging weapon, proactive visits, community events
		return 'white'
	}
}

let databaseAPI = 'http://localhost:8000';

let neighborhoodImage = L.icon({
    iconUrl: 'img/neighborhood.png',
    iconSize: [25, 25],
    popupAnchor: [0, -7]
});

function neighborhoodMarkers(){
    let neighborhoodsApi = databaseAPI+'/neighborhoods';
    let incidentsApi = databaseAPI+'/incidents';

    Promise.all([getJSON(neighborhoodsApi), getJSON(incidentsApi)])
    .then((data) => {
        for(let n in data[1]){
            for(let i in neighborhood_markers){
                if(data[1][n].neighborhood_number == i){
                    neighborhood_markers[i].count++;
                }
            }
        }
        
        for(let n in neighborhood_markers){
            console.log(data[0][n].name);
            let latLng = neighborhood_markers[n].location;
            let neighborhoodName = data[0][n].name;
            let crimeCount = neighborhood_markers[n].count;
            let popup = L.popup({closeOnClick: false, autoClose: false}).setContent(neighborhoodName + ' ' +  '('+ crimeCount +')');
            let marker = L.marker(latLng, {title: neighborhoodName, icon:neighborhoodImage}).bindPopup(popup).addTo(map).openPopup();
            neighborhood_markers[n].marker = marker;
        }

    }).catch(error => {
        console.log(error);
    })
}


function visibleNeighborhoods() {
	// returns a list of the neighborhood numbers that are visible on the map
		// based on the neighborhood center, so it might look weird at times

	let results = []

	for(let i = 0;i < neighborhood_markers.length;i++) {
		let x = neighborhood_markers[i]

		let bounds = map.getBounds()

		if(bounds.contains(L.latLng(x.location[0],x.location[1]))) {
			results.push(i+1)
		}
	}

	// console.log(results)
	// console.log(results.length)
	return results
}

function updateCheckboxes(form)
{
    var incidents = form.incidents;

    for (let i=0; i<incidents.length; i++) {
        if (incidents[i].checked) {
          app.showIncidents.push(incidents[i].value);
        }
      }

      updateCrimeTable(10);

    console.log("updating checkboxes");
    console.log(app.showIncidents);
}