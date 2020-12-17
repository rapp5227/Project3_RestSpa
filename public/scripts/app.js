let app;
let map;
let neighborhood_markers =
[
    {location: [44.942068, -93.020521], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.977413, -93.025156], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.931244, -93.079578], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.956192, -93.060189], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.978883, -93.068163], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.975766, -93.113887], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.959639, -93.121271], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.947700, -93.128505], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.930276, -93.119911], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.982752, -93.147910], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.963631, -93.167548], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.973971, -93.197965], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.949043, -93.178261], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.934848, -93.176736], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.913106, -93.170779], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.937705, -93.136997], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0},
    {location: [44.949203, -93.093739], marker: null, crimeCount: 0, policeVisits: 0, totalActivity: 0}
];

let incidentSql;
let neighborhoodSql;

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
            showIncidents: [],
            incidents: [],
            incidentMarkers: [],
            neighborhoods: [],
            showNeighborhoods: [],
            startTime: "00:00",
            endTime: "23:59",
            numCrimes: 1000,
            startDate: "2014-08-14",
            endDate: new Date().toISOString().slice(0, 10)
		}
    });

	Promise.all([getJSON('http://localhost:8000/codes'), getJSON('http://localhost:8000/neighborhoods')])
	.then(data => {
		incidentSql = data[0];
		neighborhoodSql = data[1];

		for(x of incidentSql) {
			app.incidents.push(x);
			app.showIncidents.push(x.code)
		}

		for(x of neighborhoodSql) {
			app.neighborhoods.push(x);
			app.showNeighborhoods.push(x.id);
		}

		map = L.map('leafletmap').setView([app.map.center.lat, app.map.center.lng], app.map.zoom);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			minZoom: 11,
			maxZoom: 18
		}).addTo(map);
		map.setMaxBounds([[44.883658, -93.217977], [45.008206, -92.993787]]);
		map.on('moveend',(event) => {
			console.log('map update');
			updateCrimeTable();
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

		neighborhoodMarkers();
		updateCrimeTable();
	})

}

function getLatLng(address){
    let res = 'https://nominatim.openstreetmap.org/search?format=json&country=United States&state=MN&city=St. Paul&street='+address;
    return $.getJSON(res);
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


function addressSearch(){
    getLatLng(app.map.address)
        .then(data => {

            if(data.length > 0) {
                app.map.center.lat = data[0].lat;
                app.map.center.lng = data[0].lon;
                app.map.zoom = 16;
                map.setZoom(app.map.zoom); //set zoom for address search
				map.panTo([app.map.center.lat, app.map.center.lng]); //pan to coordinates

				updateCrimeTable()
            } else {
                alert("Address '"+app.map.address+"' not found")
            }
        }).catch(error => {
            console.log(error);
        });
}

function updateCrimeTable() {

	let requestString = 'http://localhost:8000/incidents?neighborhood=' + visibleNeighborhoods().join(',')
		+ '&start_date=' + app.startDate + 'T' + app.startTime
		+ '&end_date=' + app.endDate + 'T' + app.endTime
		+ '&limit=' + app.numCrimes
		+ '&code=' + app.showIncidents.join(',')

	getJSON(requestString).then(rows => {
		let promises = new Array(rows.length)

		for(let i = 0;i < rows.length;i++) {
			promises[i] = new Promise((resolve,reject) => {
				let thisNeighborhood
				for(x of neighborhoodSql) {
					if(rows[i].neighborhood_number === x.id) {
						thisNeighborhood = x.name
						break
					}
				}

				resolve({
					date: rows[i].date,
					time: rows[i].time,
					neighborhood: thisNeighborhood,
					address: rows[i].block,
					incident: rows[i].incident,
					style: {
						backgroundColor: tableRowColor(rows[i].code)
					}
				})
			})
		}

		Promise.all(promises).then(data => {
			app.crimes = [].concat(data) // concat is used to make sure the table is re-rendered
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
		return '#009900'
	} else if (code >= 810 && code < 900) { // domestic assaults
		return 'red'
	} else if (code >= 900 && code < 1800) { // arson, property damage, graffiti
		return '#009900'
	} else if (code >= 1800 && code < 2619) { // narcotics
		return '#0066ff'
	} else { // other, discharging weapon, proactive visits, community events
		return 'white'
	}
}



function getMarkerIcon(incident){
    let image;
    if(incident.startsWith('Murder',0)){
        image = 'img/Murder.png';
    }

    else if (incident.startsWith('Rape',0)){
        image = 'img/Rape.png';
    }

    else if (incident.startsWith('Robbery',0)){
        image = 'img/Robbery.png';
    }

    else if (incident.startsWith('Aggravated Assault',0)){
        image = 'img/AggravatedAssault.png';
    }

    else if (incident.startsWith('Burglary',0)){
        image = 'img/Burglary.png';
    }

    else if (incident.startsWith('Att. Burglary',0)){
        image = 'img/AttBurglary.png';
    }

    else if (incident.startsWith('Theft',0)){
        image = 'img/Theft.png';
    }

    else if (incident.startsWith('Motor Vehicle Theft',0)){
        image = 'img/MVT.png';
    }

    else if (incident.startsWith('Att. Motor Vehicle Theft',0)){
        image = 'img/AttMVT.png';
    }

    else if (incident.startsWith('Asasult',0)){
        image = 'img/Asasult.png';
    }

    else if (incident.startsWith('Arson',0)){
        image = 'img/Arson.png';
    }

    else if (incident.startsWith('Criminal Damage to Property',0)){
        image = 'img/CDP.png';
    }

    else if (incident.startsWith('Graffiti',0)){
        image = 'img/Graffiti.png';
    }

    else if (incident.startsWith('Graffiti-Gang',0)){
        image = 'img/Graffiti-Gang.png';
    }

    else if (incident.startsWith('Narcotics',0)){
        image = 'img/Narcotics.png';
    }

    else if (incident.startsWith('Weapons',0)){
        image = 'img/Weapons.png';
    }

    else if (incident.startsWith('Proactive Police Visit',0)){
        image = 'img/PPV.png';
    }

    else if (incident.startsWith('Community Engagement Event',0)){
        image = 'img/CEE.png';
    }

    else{
        image = 'img/other.png';
    }
    return L.icon({
        iconUrl: image,
        iconSize: [40, 40],
        popupAnchor: [0, -7]
    });
}

function tableClick(date, time,address, incident){
    let prettyAddress = address.replace("0X","00");
    prettyAddress = prettyAddress.replace("1X","10");
    prettyAddress = prettyAddress.replace("2X","20");
    prettyAddress = prettyAddress.replace("3X","30");
    prettyAddress = prettyAddress.replace("4X","40");
    prettyAddress = prettyAddress.replace("5X","50");
    prettyAddress = prettyAddress.replace("6X","60");
    prettyAddress = prettyAddress.replace("7X","70");
    prettyAddress = prettyAddress.replace("8X","80");
	prettyAddress = prettyAddress.replace("9X","90");

	// some of the db's address abbreviations don't play well with nominatim. Below are fixes for the ones we noticed, but we probably missed a few.
	prettyAddress = prettyAddress.replace("FORD PA", "FORD PARKWAY");
	prettyAddress = prettyAddress.replace(" AV "," AVE ")

    getLatLng(prettyAddress)
        .then(data => {
            if(data.length > 0) {
                let popup = L.popup({closeOnClick: false, autoClose: false}).setContent(prettyAddress + '<br/>' + date + ", " + time + "<br/>" + incident);
                let marker = L.marker([data[0].lat, data[0].lon], {icon: getMarkerIcon(incident), title: prettyAddress}).bindPopup(popup).addTo(map).openPopup();
                app.incidentMarkers.push(marker);
            } else {
                alert("Address '"+address+"' not found");
            }
        }).catch(error => {
            console.log(error);
        });
}

function deleteIncidentMarkers(){
    app.incidentMarkers.forEach(marker => {
        marker.remove();
    });
    alert('Deleted All Incident Markers');
}


function neighborhoodMarkers(){
    let neighborhoods = 'http://localhost:8000/neighborhoods';
    let incidents = 'http://localhost:8000/incidents';
    let neighborhoodImg = L.icon({iconUrl: 'img/neighborhood.png',iconSize: [25, 25],popupAnchor: [0, -7]});

    Promise.all([getJSON(neighborhoods), getJSON(incidents)])
    .then((data) => {
        for(let n in data[1]){
            console.log(data[1][n].incident)
            if (data[1][n].incident.startsWith('Proactive Police Visit',0)){
                neighborhood_markers[(data[1][n].neighborhood_number)-1].policeVisits++;
            }
            else{
                neighborhood_markers[(data[1][n].neighborhood_number)-1].crimeCount++;
            }

            neighborhood_markers[(data[1][n].neighborhood_number)-1].totalActivity++;
        }

        for(let n in neighborhood_markers){
            let latLng = neighborhood_markers[n].location;
            let neighborhoodName = data[0][n].name;
            let totalActivity = neighborhood_markers[n].totalActivity;
            let crimeCount = neighborhood_markers[n].crimeCount;
            let policeVisits = neighborhood_markers[n].policeVisits;
            let popup = L.popup({closeOnClick: false, autoClose: false}).setContent(neighborhoodName + ' ' +  '- '+ totalActivity +' activities <br/>' + crimeCount + ' crimes <br/>' + policeVisits + ' police visits');
            let marker = L.marker(latLng, {title: neighborhoodName, icon:neighborhoodImg}).bindPopup(popup).addTo(map);
            neighborhood_markers[n].marker = marker;
        }

    }).catch(error => {
        console.log(error);
    })
}


function visibleNeighborhoods() {
	// returns a list of the neighborhood numbers that are visible on the map
		// based on the neighborhood center

	let results = []

	for(x of app.showNeighborhoods) {
		let index = x-1

		let location = neighborhood_markers[index]

		if(map.getBounds().contains(L.latLng(location.location[0],location.location[1]))) {
			results.push(x)
		}
	}
	return results
}

function updateCheckboxes()
{
	form = document.getElementById('form')

    var incidents = form.incidents;
    var neighborhoods = form.neighborhoods;
    var startTime = form.startTime;
    var endTime = form.endTime;
    var startDate = form.startDate;
    var endDate = form.endDate;

    app.startTime = startTime.value;
    app.endTime = endTime.value;
    app.startDate = startDate.value;
    app.endDate = endDate.value;

    app.numCrimes = form.numCrimes.value;

    app.showIncidents = [];
    app.showNeighborhoods = [];

    for (let i=0; i<incidents.length; i++) {
        if (incidents[i].checked) {
          app.showIncidents.push(incidents[i].value);
        }
    }

    for (let i=0; i<neighborhoods.length; i++) {
        if (neighborhoods[i].checked) {
          app.showNeighborhoods.push(neighborhoods[i].value);
        }
    }

	  updateCrimeTable();
}

