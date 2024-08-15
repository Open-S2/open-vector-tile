use crate::base::BaseVectorFeature;
use crate::mapbox::MapboxVectorLayer;
use crate::open::{Extent, Shape};

use alloc::string::String;
use alloc::vec::Vec;

/// Base Vector Layer
/// This is an intermediary for storing layer data in the Open Vector Tile format.
#[derive(Debug)]
pub struct BaseVectorLayer {
    /// the version of the vector tile. This is a number that tracks the OVT specification. and shouldn't be tampered with
    pub version: u8,
    /// the name of the layer
    pub name: String,
    /// the extent of the vector tile (only **512**, **1_024**, **2_048**, **4_096**, and **8_192** are supported)
    pub extent: Extent,
    /// if the shape was already passed in to the constructor
    pub shape_defined: bool,
    /// if the M-Shape was already passed in to the constructor
    pub m_shape_defined: bool,
    /// The shape used to describe the features properties in the layer
    pub shape: Shape,
    /// the shape of each feature's M-Values
    pub m_shape: Option<Shape>,
    /// the features in the layer
    pub features: Vec<BaseVectorFeature>,
}
impl BaseVectorLayer {
    /// Create a new BaseVectorLayer
    pub fn new(
        name: String,
        extent: Extent,
        features: Vec<BaseVectorFeature>,
        shape: Option<Shape>,
        m_shape: Option<Shape>,
    ) -> Self {
        Self {
            version: 1,
            name,
            extent,
            shape_defined: shape.is_some(),
            m_shape_defined: m_shape.is_some(),
            shape: shape.unwrap_or_default(),
            m_shape,
            features,
        }
    }

    /// Add a new feature to the layer
    pub fn add_feature(&mut self, feature: BaseVectorFeature) {
        if !self.shape_defined {
            let prop_shape = (feature.properties()).clone().into();
            self.shape.merge(&prop_shape);
        }
        if !self.m_shape_defined {
            if let Some(m_values) = feature.m_values() {
                let feature_shape: Shape = (&m_values[..]).into();
                match self.m_shape {
                    Some(ref mut m_shape) => m_shape.merge(&feature_shape),
                    None => self.m_shape = Some(feature_shape),
                }
            }
        }

        self.features.push(feature);
    }

    /// Get the feature at the given index
    pub fn feature(&self, i: usize) -> &BaseVectorFeature {
        &self.features[i]
    }

    /// Get the number of features
    pub fn len(&self) -> usize {
        self.features.len()
    }

    /// Check if the layer is empty
    pub fn is_empty(&self) -> bool {
        self.features.is_empty()
    }
}
impl From<&mut MapboxVectorLayer> for BaseVectorLayer {
    fn from(mvt: &mut MapboxVectorLayer) -> Self {
        let mut bvt = Self {
            version: 1,
            name: mvt.name.clone(),
            extent: mvt.extent.into(),
            shape_defined: false,
            m_shape_defined: false,
            shape: Shape::default(),
            m_shape: None,
            features: Vec::new(),
        };

        for feature in mvt.features.values_mut() {
            bvt.add_feature(feature.into());
        }

        bvt
    }
}
