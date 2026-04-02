const map = L.map('map').setView([52.1, 5.1], 18);

// Satelliet (gratis alternatief)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const bedLayer = new L.FeatureGroup();
map.addLayer(bedLayer);

// Draw control
const drawControl = new L.Control.Draw({
  draw: { polygon: true, rectangle: false, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// Wanneer veld getekend wordt
map.on(L.Draw.Event.CREATED, function (e) {
  drawnItems.clearLayers();
  bedLayer.clearLayers();

  const layer = e.layer;
  drawnItems.addLayer(layer);

  generateBeds(layer);
});


// 🔥 BEDDEN GENEREREN (ECHTE METERS)
function generateBeds(layer) {
  const polygon = layer.toGeoJSON();

  const bbox = turf.bbox(polygon);

  const spacing = 1.5; // meters

  const lines = [];

  const length = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[1]]),
    { units: 'meters' }
  );

  const steps = Math.floor(length / spacing);

  for (let i = 0; i < steps; i++) {

    const offset = i * spacing;

    let line = turf.lineOffset(
      turf.lineString([
        [bbox[0], bbox[1]],
        [bbox[0], bbox[3]]
      ]),
      offset,
      { units: 'meters' }
    );

    let clipped = turf.intersect(polygon, turf.buffer(line, 0.1, {units: 'meters'}));

    if (clipped) {
      let leafletLine = L.geoJSON(clipped, {
        color: getRandomColor(),
        weight: 3
      }).addTo(bedLayer);

      leafletLine.feature.properties = {
        name: "Onbekend"
      };

      leafletLine.on('click', function () {
        let name = prompt("Naam tulp:", this.feature.properties.name);
        if (name) {
          this.feature.properties.name = name;
          this.bindPopup(name).openPopup();
        }
      });
    }
  }
}

// 🎨 random kleur
function getRandomColor() {
  return "#" + Math.floor(Math.random()*16777215).toString(16);
}


// 💾 OPSLAAN
function saveData() {
  const data = bedLayer.toGeoJSON();
  const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "veld.json";
  a.click();
}


// 📂 LADEN
function loadData(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = JSON.parse(e.target.result);
    bedLayer.clearLayers();

    L.geoJSON(data, {
      style: f => ({ color: f.properties.color || 'red' }),
      onEachFeature: (feature, layer) => {
        layer.on('click', function () {
          let name = prompt("Naam tulp:", feature.properties.name);
          if (name) {
            feature.properties.name = name;
            layer.bindPopup(name).openPopup();
          }
        });
      }
    }).addTo(bedLayer);
  };

  reader.readAsText(file);
}
