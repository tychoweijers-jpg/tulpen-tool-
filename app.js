const map = L.map('map').setView([52.1, 5.1], 18);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22
}).addTo(map);

const drawnItems = new L.FeatureGroup().addTo(map);
const bedLayer = new L.FeatureGroup().addTo(map);

let currentAngle = 0;
let activeBedLayer = null;
let activeLabelMarker = null;

// Richting control
const control = L.control({position: 'topright'});
control.onAdd = function () {
  const div = L.DomUtil.create('div', 'control');
  div.innerHTML = `
    <button onclick="rotateBeds(-5)">⟲ Links</button>
    <button onclick="rotateBeds(5)">⟳ Rechts</button>
  `;
  return div;
};
control.addTo(map);

const drawControl = new L.Control.Draw({
  draw: { polygon: true, rectangle: true, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (e) {
  drawnItems.clearLayers();
  bedLayer.clearLayers();
  const layer = e.layer;
  drawnItems.addLayer(layer);
  generateBeds(layer);
});

function generateBeds(layer) {
  bedLayer.clearLayers();
  closeEditPanel();

  const polygon = layer.toGeoJSON();
  const bbox = turf.bbox(polygon);
  const spacing = 1.5;

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

      const center = turf.centroid(clipped).geometry.coordinates;

      let label = L.marker([center[1], center[0]], {
        icon: L.divIcon({
          className: 'label',
          html: layerBed.feature.properties.name
        })
      }).addTo(bedLayer);

      layerBed.on('click', function () {
        openEditPanel(this, label);
      });
    }
  }

  document.getElementById("count").innerText = "Bedden: " + count;
}

function openEditPanel(bedLayer, labelMarker) {
  activeBedLayer = bedLayer;
  activeLabelMarker = labelMarker;

  const props = bedLayer.feature.properties;
  document.getElementById('editName').value = props.name;
  document.getElementById('editColor').value = props.color;
  document.getElementById('editPanel').style.display = 'block';
}

function closeEditPanel() {
  document.getElementById('editPanel').style.display = 'none';
  activeBedLayer = null;
  activeLabelMarker = null;
}

function applyEdit() {
  if (!activeBedLayer) return;

  const name = document.getElementById('editName').value;
  const color = document.getElementById('editColor').value;

  activeBedLayer.feature.properties.name = name;
  activeBedLayer.feature.properties.color = color;

  activeBedLayer.setStyle({ fillColor: color });

  activeLabelMarker.setIcon(L.divIcon({
    className: 'label',
    html: name,
    style: `background:${color}`
  }));

  closeEditPanel();
}

function rotateBeds(deg) {
  currentAngle += deg;
  const field = drawnItems.getLayers()[0];
  if (field) generateBeds(field);
}

function getRandomColor() {
  const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function saveData() {
  const data = bedLayer.toGeoJSON();
  const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "velden.json";
  a.click();
}

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

        layer.feature = feature;
        layer.on('click', function () {
          openEditPanel(this, label);
        });
      }
    }).addTo(bedLayer);
  };

  reader.readAsText(file);
}
