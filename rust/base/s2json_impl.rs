use super::{
    tess_to_points, tess_to_points_3d, BaseVectorFeature, BaseVectorLines3DFeature,
    BaseVectorLinesFeature, BaseVectorPoints3DFeature, BaseVectorPointsFeature,
    BaseVectorPolys3DFeature, BaseVectorPolysFeature,
};
use crate::{
    VectorLine3DWithOffset, VectorLineWithOffset, VectorLines3DWithOffset, VectorLinesWithOffset,
};
use alloc::{vec, vec::Vec};
use s2json::{
    MValueCompatible, Properties, VectorFeature, VectorLineString, VectorMultiLineString,
    VectorMultiPolygon,
};

// This is a convenience function to convert an S2JSON VectorFeature to a BaseVectorFeature

impl<M: Clone, P: MValueCompatible, D: MValueCompatible> From<&VectorFeature<M, P, D>>
    for BaseVectorFeature
{
    fn from(vf: &VectorFeature<M, P, D>) -> Self {
        let id = vf.id;
        let properties: Properties = vf.properties.clone().into();

        match &vf.geometry {
            s2json::VectorGeometry::Point(p) => {
                if !p.is_3d {
                    BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature::new(
                        id,
                        vec![(&p.coordinates).into()],
                        properties,
                        p.bbox.map(|b| b.into()),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature::new(
                        id,
                        vec![(&p.coordinates).into()],
                        properties,
                        p.bbox,
                    ))
                }
            }
            s2json::VectorGeometry::MultiPoint(mp) => {
                if !mp.is_3d {
                    BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature::new(
                        id,
                        mp.coordinates.iter().map(|p| p.into()).collect(),
                        properties,
                        mp.bbox.map(|b| b.into()),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature::new(
                        id,
                        mp.coordinates.iter().map(|p| p.into()).collect(),
                        properties,
                        mp.bbox,
                    ))
                }
            }
            s2json::VectorGeometry::LineString(l) => {
                if !l.is_3d {
                    BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature::new(
                        id,
                        vec![vl_to_ls_w_off(l.offset.unwrap_or_default(), &l.coordinates)],
                        properties,
                        l.bbox.map(|b| b.into()),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature::new(
                        id,
                        vec![vl_to_ls_w_off_3d(l.offset.unwrap_or_default(), &l.coordinates)],
                        properties,
                        l.bbox,
                    ))
                }
            }
            s2json::VectorGeometry::MultiLineString(ml) => {
                if !ml.is_3d {
                    BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature::new(
                        id,
                        vml_to_ls_w_off(ml.offset.as_ref(), &ml.coordinates),
                        properties,
                        ml.bbox.map(|b| b.into()),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature::new(
                        id,
                        vml_to_ls_w_off_3d(ml.offset.as_ref(), &ml.coordinates),
                        properties,
                        ml.bbox,
                    ))
                }
            }
            s2json::VectorGeometry::Polygon(p) => {
                if !p.is_3d {
                    BaseVectorFeature::BaseVectorPolysFeature(BaseVectorPolysFeature::new(
                        id,
                        vec![vml_to_ls_w_off(p.offset.as_ref(), &p.coordinates)],
                        properties,
                        p.bbox.map(|b| b.into()),
                        p.indices.clone().unwrap_or_default(),
                        p.tessellation.clone().map(tess_to_points).unwrap_or_default(),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature::new(
                        id,
                        vec![vml_to_ls_w_off_3d(p.offset.as_ref(), &p.coordinates)],
                        properties,
                        p.bbox,
                        p.indices.clone().unwrap_or_default(),
                        p.tessellation.clone().map(tess_to_points_3d).unwrap_or_default(),
                    ))
                }
            }
            s2json::VectorGeometry::MultiPolygon(mp) => {
                if !mp.is_3d {
                    BaseVectorFeature::BaseVectorPolysFeature(BaseVectorPolysFeature::new(
                        id,
                        vmp_to_ls_w_off(mp.offset.as_ref(), &mp.coordinates),
                        properties,
                        mp.bbox.map(|b| b.into()),
                        mp.indices.clone().unwrap_or_default(),
                        mp.tessellation.clone().map(tess_to_points).unwrap_or_default(),
                    ))
                } else {
                    BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature::new(
                        id,
                        vmp_to_ls_w_off_3d(mp.offset.as_ref(), &mp.coordinates),
                        properties,
                        mp.bbox,
                        mp.indices.clone().unwrap_or_default(),
                        mp.tessellation.clone().map(tess_to_points_3d).unwrap_or_default(),
                    ))
                }
            }
        }
    }
}

/// Vector MultiPolygon to Vec<VectorLinesWithOffset>
fn vmp_to_ls_w_off<D: MValueCompatible>(
    offsets: Option<&Vec<Vec<f64>>>,
    mp: &VectorMultiPolygon<D>,
) -> Vec<VectorLinesWithOffset> {
    mp.iter().enumerate().map(|(i, l)| vml_to_ls_w_off(offsets.and_then(|o| o.get(i)), l)).collect()
}

/// Vector MultiLineString to VectorLinesWithOffset
fn vml_to_ls_w_off<D: MValueCompatible>(
    offsets: Option<&Vec<f64>>,
    vl: &VectorMultiLineString<D>,
) -> VectorLinesWithOffset {
    vl.iter()
        .enumerate()
        .map(|(i, l)| {
            vl_to_ls_w_off(offsets.and_then(|o| o.get(i).copied()).unwrap_or_default(), l)
        })
        .collect()
}

/// Vector LineString to VectorLineWithOffset
fn vl_to_ls_w_off<D: MValueCompatible>(
    offset: f64,
    vl: &VectorLineString<D>,
) -> VectorLineWithOffset {
    VectorLineWithOffset::new(offset, vl.iter().map(|p| p.into()).collect())
}

/// Vector MultiPolygon to Vec<VectorLines3DWithOffset>
fn vmp_to_ls_w_off_3d<D: MValueCompatible>(
    offsets: Option<&Vec<Vec<f64>>>,
    mp: &VectorMultiPolygon<D>,
) -> Vec<VectorLines3DWithOffset> {
    mp.iter()
        .enumerate()
        .map(|(i, l)| vml_to_ls_w_off_3d(offsets.and_then(|o| o.get(i)), l))
        .collect()
}

/// Vector MultiLineString to VectorLines3DWithOffset
fn vml_to_ls_w_off_3d<D: MValueCompatible>(
    offsets: Option<&Vec<f64>>,
    vl: &VectorMultiLineString<D>,
) -> VectorLines3DWithOffset {
    vl.iter()
        .enumerate()
        .map(|(i, l)| {
            vl_to_ls_w_off_3d(offsets.and_then(|o| o.get(i).copied()).unwrap_or_default(), l)
        })
        .collect()
}

/// Vector LineString to VectorLine3DWithOffset
fn vl_to_ls_w_off_3d<D: MValueCompatible>(
    offset: f64,
    vl: &VectorLineString<D>,
) -> VectorLine3DWithOffset {
    VectorLine3DWithOffset::new(offset, vl.iter().map(|p| p.into()).collect())
}
