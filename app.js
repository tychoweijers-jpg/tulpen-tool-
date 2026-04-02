const map = L.map('map').setView([52.1, 5.1], 18);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22
}).addTo(map);

const drawnItems = new L.FeatureGroup().addTo(map);
const bedLayer = new L.FeatureGroup().addTo(map);

let currentAngle = 0;

// UI knop voor richting
const control = L.control({position: 'topright'});
control.onAdd = function () {
  const div = L.DomUtil.create('div', 'control');
  div.innerHTML = `
    <button onclick="rotateBeds(-5)">⟲</button>
    <button onclick="rotateBeds(5)">⟳</button>
    <div id="count"></div>
  `;
  return div;
};
control.addTo(map);


const drawControl = new L.Control.Draw({
  draw: { polygon: true, rectangle: true, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);


// tekenen
map.on(L.Draw.Event.CREATED, function (e) {
  drawnItems.clearLayers();
  bedLayer.clearLayers();

  const layer = e.layer;
  drawnItems.addLayer(layer);

  generateBeds(layer);
});


// 🔥 BEDDEN ALS VLAKKEN
function generateBeds(layer) {

  bedLayer.clearLayers();

  const polygon = layer.toGeoJSON();
  const bbox = turf.bbox(polygon);

  const spacing = 1.5; // meter

  const diagonal = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[3]]),
    {units: 'meters'}
  );

  const steps = Math.floor(diagonal / spacing);

  let count = 0;

  for (let i = -steps; i < steps; i++) {

    let baseLine = turf.lineString([
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]]
    ]);

    baseLine = turf.transformRotate(baseLine, currentAngle, {
      pivot: turf.centroid(polygon)
    });

    let offsetLine = turf.lineOffset(baseLine, i * spacing, {units: 'meters'});

    // maak strook (rechthoek)
    let bed = turf.buffer(offsetLine, spacing / 2, {units: 'meters'});

    let clipped = turf.intersect(polygon, bed);

    if (clipped) {

      count++;

      const color = getRandomColor();

      let layerBed = L.geoJSON(clipped, {
        style: {
          color: "#333",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.6
        }
      }).addTo(bedLayer);

      layerBed.feature = {
        properties: {
          name: "Bed " + count,
          color: color
        }
      };

      // label tonen
      const center = turf.centroid(clipped).geometry.coordinates;

      let label = L.marker([center[1], center[0]], {
        icon: L.divIcon({
          className: 'label',
          html: layerBed.feature.properties.name
        })
      }).addTo(bedLayer);

      // klik = aanpassen
      layerBed.on('click', function () {

        let name = prompt("Naam tulp:", this.feature.properties.name);
        let newColor = prompt("Kleur (#ff0000):", this.feature.properties.color);

        if (name) {
          this.feature.properties.name = name;
          label.setIcon(L.divIcon({
            className: 'label',
            html: name
          }));
        }

        if (newColor) {
          this.feature.properties.color = newColor;
          this.setStyle({fillColor: newColor});
        }
      });
    }
  }

  document.getElementById("count").innerText = "Bedden: " + count;
}


// 🔄 draaien
function rotateBeds(deg) {
  currentAngle += deg;

  const field = drawnItems.getLayers()[0];
  if (field) generateBeds(field);
}


// kleur
function getRandomColor() {
  return "#" + Math.floor(Math.random()*16777215).toString(16);
}


// 💾 save
function saveData() {
  const data = bedLayer.toGeoJSON();
  const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "velden.json";
  a.click();
}


// 📂 load
function loadData(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = JSON.parse(e.target.result);
    bedLayer.clearLayers();

    L.geoJSON(data, {
      style: f => ({
        color: "#333",
        fillColor: f.properties.color,
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {

        const center = turf.centroid(feature).geometry.coordinates;

        let label = L.marker([center[1], center[0]], {
          icon: L.divIcon({
            className: 'label',
            html: feature.properties.name
          })
        }).addTo(bedLayer);

        layer.on('click', function () {

          let name = prompt("Naam:", feature.properties.name);
          let color = prompt("Kleur:", feature.properties.color);

          if (name) {
            feature.properties.name = name;
            label.setIcon(L.divIcon({className: 'label', html: name}));
          }

          if (color) {
            feature.properties.color = color;
            layer.setStyle({fillColor: color});
          }
        });
      }
    }).addTo(bedLayer);
  };

  reader.readAsText(file);
}
