// create marker collection
var Markers = new Meteor.Collection('markers');
var busIcon = L.icon({
    iconUrl: 'icons/icon-Bus-Tracker.png',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});
var busIconBlue = L.icon({
    iconUrl: 'icons/icon-Bus-Tracker-blue.png',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});
var metroRailIcon = L.icon({
    iconUrl: 'icons/icon-Rail-Tracker.png',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});
var map;
var apiURL = 'https://miami-transit-api.herokuapp.com/';

Meteor.subscribe('markers');

Template.map.rendered = function() {
  L.Icon.Default.imagePath = 'packages/bevanhunt_leaflet/images';

  map = L.map('map', {
    doubleClickZoom: true
  }).setView([25.48044, -80.137], 9);

  L.tileLayer.provider('Thunderforest.Outdoors').addTo(map);

  map.on('dblclick', function(event) {
    //Markers.insert({latlng: event.latlng});
  });

  addMetroRail();
  addMdtBuses();
  addMetroRailRoutes();
  loadBusTrackingGPSData();

  var query = Markers.find();
  query.observe({
    added: function (document) {
      var marker = L.marker(document.latlng).addTo(map)
        .on('click', function(event) {
          map.removeLayer(marker);
          Markers.remove({_id: document._id});
        });
    },
    removed: function (oldDocument) {
      layers = map._layers;
      var key, val;
      for (key in layers) {
        val = layers[key];
        if (val._latlng) {
          if (val._latlng.lat === oldDocument.latlng.lat && val._latlng.lng === oldDocument.latlng.lng) {
            map.removeLayer(val);
          }
        }
      }
    }
  });
};

function addMdtBuses() {
  $.getJSON(apiURL + 'api/Buses.json',
  function(data) {
    var records = data.RecordSet.Record;
    if (records !== null) generateBusList(records);
  });
}

function generateBusList(data) {
  var i = 0;
  for (i = 0; i < data.length; i++) {
    // Add each bus to the map
    addBusMarker(
      data[i].Latitude,
      data[i].Longitude,
      data[i].BusName,
      data[i].TripHeadsign,
      data[i].BusID,
      data[i].LocationUpdated
    );
    requestRouteShape(data[i].TripID);
  }
}

function addBusMarker(lat, lon, name, desc, id, time) {
  var marker = L.marker([lat, lon], {icon: busIcon}).bindPopup(
      name+': Bus # '+desc+
      ' (ID: '+id+') <br /> Location Updated: '+time,
      { offset: new L.Point(0, 0) });
  marker.addTo(map);
}

function addMetroRail() {
  $.getJSON(apiURL + 'api/Trains.json',
  function(data) {
    if (data.RecordSet === null) return; // No rail data at night
    var records = data.RecordSet.Record;
    var i = 0;
    for (i = 0; i < records.length; i++) {
      addMetroRailMarker(
        records[i].Latitude,
        records[i].Longitude,
        records[i].TrainID,
        records[i].LineID,
        records[i].Cars,
        records[i].Direction,
        records[i].ServiceDirection,
        records[i].LocationUpdated
        );
    }
  });
}

function addMetroRailMarker(Latitude, Longitude, TrainID, LineID, Cars, Direction, ServiceDirection, LocationUpdated) {
  var marker = L.marker([Latitude, Longitude], {icon: metroRailIcon, zIndexOffset: 100}).bindPopup(
      '<strong>Metro Rail Train ' + TrainID +
      '<br>Line: ' + LineID +
      '</strong><br><br>Cars: ' + Cars +
      '<br>Direction: ' +  Direction +
      '<br>Service Direction: ' + ServiceDirection +
      '<br>Location Updated: ' + LocationUpdated,
      { offset: new L.Point(0, 0) });
    map.addLayer(marker);
}

function loadBusRoutes() {
  $.getJSON(apiURL + 'api/BusRoutes.json',
  function(data) {
    var records = data.RecordSet.Record;
    var i = 0;
    for (i = 0; i < records.length; i++) {
      // Add to global ref list
      // Data format is {tripId: "", routeId: "", shapeId: "", color: ""}
      var route = records[i].RouteID;
      for (j = 0; j < tripRouteShapeRef.length; j++) {
        if (tripRouteShapeRef[j].routeId == route) {
          tripRouteShapeRef[j].color = records[i].RouteColor;
        }
      }
    }
  });
}

function requestRouteShape(tripId) {
  $.getJSON(apiURL + 'api/BusRouteShapesByTrip.json?TripID='+tripId,
  function(data) {
    var shapeId = data.RecordSet.Record.ShapeID;
    requestRouteShapePoints(shapeId);
  });
}

function requestRouteShapePoints(shapeId) {
  $.getJSON(apiURL + 'api/BusRouteShape.json?ShapeID='+shapeId,
  function(data) {
    var records = data.RecordSet.Record;
    var latlngs = [];
    for (i = 0; i < records.length; i++) {
      latlngs[latlngs.length] = (L.latLng(records[i].Latitude, records[i].Longitude));
    }

    var markerLine = L.polyline(latlngs, {color: 'blue'});
    markerLine.addTo(map);
  });
}

function addMetroRailRoutes() {
  $.getJSON(apiURL + 'api/TrainMapShape.json',
  function(data) {
    var records = data.RecordSet.Record;
    var greenLineLatLngs = [];
    var orangeLineLatLngs = [];
    var i = 0;
    for (i = 0; i < records.length; i++) {
      if (records[i].LineID === "GRN") {
        greenLineLatLngs.push(L.latLng(records[i].Latitude, records[i].Longitude));
      } else {
        orangeLineLatLngs.push(L.latLng(records[i].Latitude, records[i].Longitude));
      }
    }
    addMetroRailRouteColors(
      greenLineLatLngs,
      "green"
    );
    addMetroRailRouteColors(
      orangeLineLatLngs,
      "orange"
    );
  });
}

function addMetroRailRouteColors(latlngs, color) {
  var lineMarker = L.polyline(latlngs, {color: color});
  lineMarker.addTo(map);
}

function loadBusTrackingGPSData() {
  $.getJSON(apiURL+'tracker.json',
  function(data) {
    var records = data.features;
    var i = 0;
    for (i = 0; i < records.length; i++) {
      addBusTrackingGPSMarker(
        records[i].properties.BusID,
        records[i].properties.lat,
        records[i].properties.lon,
        records[i].properties.speed,
        records[i].properties.bustime);
    }
  });
}

function addBusTrackingGPSMarker(BusID, lat, lon, speed, bustime) {
  try {
    var marker = L.marker([lat, lon], {icon: busIconBlue}).bindPopup(
        '<strong>Bus Tracking GPS</strong>'+
		    '<br /><br />Bus ID: ' +BusID+
        '<br />Speed: ' +speed+ ' MPH'+
        '<br />Bus Time: '+bustime,
        { offset: new L.Point(0, -22) });
    marker.addTo(map);
  } catch (e) {
    console.log("Cannot add marker in addBusTrackingGPSMarker. Lat: "+lat+" Lon: "+lon+" Error: "+e);
  }
}
