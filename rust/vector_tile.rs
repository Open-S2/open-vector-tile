use crate::{
    VectorGeometry, VectorLines3DWithOffset, VectorLinesWithOffset, VectorPoints, VectorPoints3D,
    base::BaseVectorTile,
    mapbox::MapboxVectorLayer,
    open::{
        ColumnCacheReader, ColumnCacheWriter, FeatureType, GridData, ImageData, OpenVectorLayer,
        write_layer,
    },
};
use alloc::{collections::BTreeMap, rc::Rc, string::String, vec::Vec};
use core::cell::RefCell;
use pbf::{ProtoRead, Protobuf};
use s2json::{BBOX, Properties};

/// Methods that all vector features should have
pub trait VectorFeatureMethods {
    /// the id of the feature
    fn id(&self) -> Option<u64>;
    /// the version of the vector tile
    fn version(&self) -> u16;
    /// the properties
    fn properties(&self) -> Properties;
    /// the extent
    fn extent(&self) -> usize;
    /// the feature type
    fn get_type(&self) -> FeatureType;
    /// the bounding box
    fn bbox(&self) -> Option<BBOX>;
    /// whether the feature has m values
    fn has_m_values(&self) -> bool;
    /// whether the feature is a points type
    fn is_points(&self) -> bool;
    /// whether the feature is a line type
    fn is_lines(&self) -> bool;
    /// whether the feature is a polygon type
    fn is_polygons(&self) -> bool;
    /// whether the feature is a points 3D type
    fn is_points_3d(&self) -> bool;
    /// whether the feature is a line 3D type
    fn is_lines_3d(&self) -> bool;
    /// whether the feature is a polygon 3D type
    fn is_polygons_3d(&self) -> bool;
    /// regardless of the type, we return a flattend point array
    fn load_points(&mut self) -> VectorPoints;
    /// regardless of the type, we return a flattend point3D array
    fn load_points_3d(&mut self) -> VectorPoints3D;
    /// an array of lines.
    fn load_lines(&mut self) -> VectorLinesWithOffset;
    /// an array of 3D lines.
    fn load_lines_3d(&mut self) -> VectorLines3DWithOffset;
    /// an array of polygons.
    fn load_polys(&mut self) -> Vec<VectorLinesWithOffset>;
    /// an array of 3D polygons.
    fn load_polys_3d(&mut self) -> Vec<VectorLines3DWithOffset>;
    /// (flattened geometry & tesslation if applicable, indices)
    fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>);
    /// load the geometry
    fn load_geometry(&mut self) -> VectorGeometry;
    /// load the indices
    fn read_indices(&mut self) -> Vec<u32>;
    /// Add tessellation data to the geometry
    fn add_tessellation(&mut self, geometry: &mut Vec<f64>, multiplier: f64);
    /// Add 3D tessellation data to the geometry
    fn add_tessellation_3d(&mut self, geometry: &mut Vec<f64>, multiplier: f64);
}

/// Methods that all vector layers should have
pub trait VectorLayerMethods {
    /// the version of the vector tile layer.
    fn version(&self) -> u16;
    /// the name of the layer
    fn name(&self) -> String;
    /// the extent of the vector tile (only **512**, **1_024**, **2_048**, **4_096**, and **8_192**
    /// are supported for the open spec)
    fn extent(&self) -> usize;
    /// grab a feature from the layer
    fn feature(&mut self, i: usize) -> Option<&mut dyn VectorFeatureMethods>;
    /// length (layer count)
    fn len(&self) -> usize;
    /// empty (layer count is 0)
    fn is_empty(&self) -> bool;
}

/// Layer container supporting both mapbox and open vector layers
#[derive(Debug)]
pub enum VectorLayer {
    /// Mapbox vector layer
    Mapbox(MapboxVectorLayer),
    /// Open vector layer
    Open(OpenVectorLayer),
}
impl VectorLayerMethods for VectorLayer {
    fn version(&self) -> u16 {
        match self {
            VectorLayer::Mapbox(layer) => layer.version(),
            VectorLayer::Open(layer) => layer.version(),
        }
    }

    fn name(&self) -> String {
        match self {
            VectorLayer::Mapbox(layer) => layer.name(),
            VectorLayer::Open(layer) => layer.name(),
        }
    }

    fn extent(&self) -> usize {
        match self {
            VectorLayer::Mapbox(layer) => layer.extent(),
            VectorLayer::Open(layer) => layer.extent(),
        }
    }

    fn feature(&mut self, i: usize) -> Option<&mut dyn VectorFeatureMethods> {
        match self {
            VectorLayer::Mapbox(layer) => layer.feature(i),
            VectorLayer::Open(layer) => layer.feature(i),
        }
    }

    fn len(&self) -> usize {
        match self {
            VectorLayer::Mapbox(layer) => layer.len(),
            VectorLayer::Open(layer) => layer.len(),
        }
    }

    fn is_empty(&self) -> bool {
        match self {
            VectorLayer::Mapbox(layer) => layer.is_empty(),
            VectorLayer::Open(layer) => layer.is_empty(),
        }
    }
}

/// # Open Vector Tile
///
/// ## Description
/// A Vector Tile may parse either Mapbox or OpenVector Tile Layers
/// The input is an unsigned byte array that has encoded protobuffer messages.
///
/// Types of layers include:
/// - Vector data - vector points, lines, and polygons with 3D coordinates, properties, and/or m-values
/// - Image data - raster data that is RGB(A) encoded
/// - Grid data: data that has a max-min range, works much like an image but has floating/double precision point values for each point on the grid
///
/// ## Usage
/// ```rust,ignore
/// use ovtile::{VectorTile, VectorLayerMethods};
///
/// let data: Vec<u8> = vec![];
/// let mut tile = VectorTile::new(data, None);
///
/// // VECTOR API
///
/// let landuse = tile.layer("landuse").unwrap();
///
/// // grab the first feature
/// let firstFeature = landuse.feature(0).unwrap();
/// // grab the geometry
/// let geometry = firstFeature.load_geometry();
///
/// // OR specifically ask for a geometry type
/// let points = firstFeature.load_points();
/// let lines = firstFeature.load_lines();
///
/// // If you want to take advantage of the pre-tessellated and indexed geometries
/// // and you're loading the data for a renderer, you can grab the pre-tessellated geometry
/// let (geometry_flat, indices) = firstFeature.load_geometry_flat();
///
/// // IMAGE API
///
/// let satellite = tile.images.get("satellite").unwrap();
/// // grab the image data
/// let data = &satellite.image;
///
/// // GRID API
///
/// let elevation = tile.grids.get("elevation").unwrap();
/// // grab the grid data
/// let data = &elevation.data;
/// ```
#[derive(Debug)]
pub struct VectorTile {
    /// the layers in the vector tile
    pub layers: BTreeMap<String, VectorLayer>,
    /// indexes to track the layers. Needed for the open spec because we need the cache before we can
    /// parse layers and features
    layer_indexes: Vec<usize>,
    /// the protobuf for the vector tile
    pbf: Rc<RefCell<Protobuf>>,
    /// the column cache
    columns: Option<Rc<RefCell<ColumnCacheReader>>>,
    /// Gridded data
    pub grids: BTreeMap<String, GridData>,
    /// Image data
    pub images: BTreeMap<String, ImageData>,
}
impl VectorTile {
    /// Create a new vector tile
    pub fn new(data: Vec<u8>, end: Option<usize>) -> Self {
        let pbf = Rc::new(RefCell::new(data.into()));
        let mut vt = VectorTile {
            pbf: pbf.clone(),
            columns: None,
            layer_indexes: Vec::new(),
            layers: BTreeMap::new(),
            grids: BTreeMap::new(),
            images: BTreeMap::new(),
        };

        pbf.borrow_mut().read_fields(&mut vt, end);

        if !vt.layer_indexes.is_empty() {
            vt.read_layers();
        }

        vt
    }

    /// Read the layers
    pub fn read_layers(&mut self) -> Option<()> {
        let layer_indexes = self.layer_indexes.clone();
        let mut tmp_pbf = self.pbf.borrow_mut();
        let cache = self.columns.as_ref()?.clone();

        for pos in layer_indexes {
            tmp_pbf.set_pos(pos);
            let mut layer = OpenVectorLayer::new(cache.clone());
            tmp_pbf.read_message(&mut layer);
            self.layers.insert(layer.name.clone(), VectorLayer::Open(layer));
        }

        Some(())
    }

    /// Get a layer given the name
    pub fn layer(&mut self, name: &str) -> Option<&mut VectorLayer> {
        self.layers.get_mut(name)
    }
}
impl ProtoRead for VectorTile {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 | 3 => {
                let mut layer = MapboxVectorLayer::new(self.pbf.clone(), tag == 1);
                pb.read_message(&mut layer);
                self.layers.insert(layer.name.clone(), VectorLayer::Mapbox(layer));
            }
            4 => {
                // store the position of each layer for later retrieval.
                // Columns must be prepped before reading the layer.
                self.layer_indexes.push(pb.get_pos());
            }
            5 => {
                let mut column_reader = ColumnCacheReader::new();
                pb.read_message(&mut column_reader);
                self.columns = Some(Rc::new(RefCell::new(column_reader)));
            }
            6 => {
                let mut grid = GridData::default();
                pb.read_message(&mut grid);
                self.grids.insert(grid.name.clone(), grid);
            }
            7 => {
                let mut image = ImageData::default();
                pb.read_message(&mut image);
                self.images.insert(image.name.clone(), image);
            }
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// writer for converting a BaseVectorTile to encoded bytes of the Open Vector Tile format
pub fn write_tile(
    tile: Option<&mut BaseVectorTile>,
    images: Option<Vec<&ImageData>>,
    grids: Option<Vec<&GridData>>,
) -> Vec<u8> {
    let mut pbf = Protobuf::new();
    let mut cache = ColumnCacheWriter::default();

    // first write layers
    if let Some(tile) = tile {
        for layer in tile.layers.values_mut() {
            pbf.write_bytes_field(4, &write_layer(layer, &mut cache));
        }
        // now we can write columns
        pbf.write_message(5, &cache);
    }
    // if an gridded data exists, let's write it
    if let Some(grids) = grids {
        for grid in grids.iter() {
            pbf.write_message(6, *grid);
        }
    }
    // if an image exists, let's write it
    if let Some(images) = images {
        for image in images.iter() {
            pbf.write_message(7, *image);
        }
    }

    pbf.take()
}
