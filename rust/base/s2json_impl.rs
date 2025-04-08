use super::{
    BaseVectorFeature, BaseVectorLines3DFeature, BaseVectorLinesFeature, BaseVectorPoints3DFeature,
    BaseVectorPointsFeature, BaseVectorPolys3DFeature, BaseVectorPolysFeature, tess_to_points,
    tess_to_points_3d,
};
use crate::{
    Extent, Point, Point3D, VectorLine3DWithOffset, VectorLineWithOffset, VectorLines3DWithOffset,
    VectorLinesWithOffset,
};
use alloc::{vec, vec::Vec};
use libm::round;
use s2json::{
    MValueCompatible, Properties, VectorFeature, VectorLineString, VectorMultiLineString,
    VectorMultiPolygon, VectorPoint,
};

// This is a convenience function to convert an S2JSON VectorFeature to a BaseVectorFeature

/// Converts a VectorFeature to a BaseVectorFeature given a target extent
pub fn s2json_to_base<M: Clone, P: MValueCompatible, D: MValueCompatible>(
    vf: &VectorFeature<M, P, D>,
    extent: Extent,
) -> BaseVectorFeature {
    let id = vf.id;
    let extent: f64 = extent.into();
    let properties: Properties = vf.properties.clone().into();

    match &vf.geometry {
        s2json::VectorGeometry::Point(p) => {
            if !p.is_3d {
                BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature::new(
                    id,
                    vec![vp_to_point(&p.coordinates, extent)],
                    properties,
                    p.bbox.map(|b| b.into()),
                ))
            } else {
                BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature::new(
                    id,
                    vec![vp_to_point3d(&p.coordinates, extent)],
                    properties,
                    p.bbox,
                ))
            }
        }
        s2json::VectorGeometry::MultiPoint(mp) => {
            if !mp.is_3d {
                BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature::new(
                    id,
                    mp.coordinates.iter().map(|p| vp_to_point(p, extent)).collect(),
                    properties,
                    mp.bbox.map(|b| b.into()),
                ))
            } else {
                BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature::new(
                    id,
                    mp.coordinates.iter().map(|p| vp_to_point3d(p, extent)).collect(),
                    properties,
                    mp.bbox,
                ))
            }
        }
        s2json::VectorGeometry::LineString(l) => {
            if !l.is_3d {
                BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature::new(
                    id,
                    vec![vl_to_ls_w_off(l.offset.unwrap_or_default(), &l.coordinates, extent)],
                    properties,
                    l.bbox.map(|b| b.into()),
                ))
            } else {
                BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature::new(
                    id,
                    vec![vl_to_ls_w_off_3d(l.offset.unwrap_or_default(), &l.coordinates, extent)],
                    properties,
                    l.bbox,
                ))
            }
        }
        s2json::VectorGeometry::MultiLineString(ml) => {
            if !ml.is_3d {
                BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature::new(
                    id,
                    vml_to_ls_w_off(ml.offset.as_ref(), &ml.coordinates, extent),
                    properties,
                    ml.bbox.map(|b| b.into()),
                ))
            } else {
                BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature::new(
                    id,
                    vml_to_ls_w_off_3d(ml.offset.as_ref(), &ml.coordinates, extent),
                    properties,
                    ml.bbox,
                ))
            }
        }
        s2json::VectorGeometry::Polygon(p) => {
            if !p.is_3d {
                BaseVectorFeature::BaseVectorPolysFeature(BaseVectorPolysFeature::new(
                    id,
                    vec![vml_to_ls_w_off(p.offset.as_ref(), &p.coordinates, extent)],
                    properties,
                    p.bbox.map(|b| b.into()),
                    p.indices.clone().unwrap_or_default(),
                    p.tessellation.clone().map(tess_to_points).unwrap_or_default(),
                ))
            } else {
                BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature::new(
                    id,
                    vec![vml_to_ls_w_off_3d(p.offset.as_ref(), &p.coordinates, extent)],
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
                    vmp_to_ls_w_off(mp.offset.as_ref(), &mp.coordinates, extent),
                    properties,
                    mp.bbox.map(|b| b.into()),
                    mp.indices.clone().unwrap_or_default(),
                    mp.tessellation.clone().map(tess_to_points).unwrap_or_default(),
                ))
            } else {
                BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature::new(
                    id,
                    vmp_to_ls_w_off_3d(mp.offset.as_ref(), &mp.coordinates, extent),
                    properties,
                    mp.bbox,
                    mp.indices.clone().unwrap_or_default(),
                    mp.tessellation.clone().map(tess_to_points_3d).unwrap_or_default(),
                ))
            }
        }
    }
}

/// Vector MultiPolygon to Vec<VectorLinesWithOffset>
fn vmp_to_ls_w_off<D: MValueCompatible>(
    offsets: Option<&Vec<Vec<f64>>>,
    mp: &VectorMultiPolygon<D>,
    extent: f64,
) -> Vec<VectorLinesWithOffset> {
    mp.iter()
        .enumerate()
        .map(|(i, l)| vml_to_ls_w_off(offsets.and_then(|o| o.get(i)), l, extent))
        .collect()
}

/// Vector MultiLineString to VectorLinesWithOffset
fn vml_to_ls_w_off<D: MValueCompatible>(
    offsets: Option<&Vec<f64>>,
    vl: &VectorMultiLineString<D>,
    extent: f64,
) -> VectorLinesWithOffset {
    vl.iter()
        .enumerate()
        .map(|(i, l)| {
            vl_to_ls_w_off(offsets.and_then(|o| o.get(i).copied()).unwrap_or_default(), l, extent)
        })
        .collect()
}

/// Vector LineString to VectorLineWithOffset
fn vl_to_ls_w_off<D: MValueCompatible>(
    offset: f64,
    vl: &VectorLineString<D>,
    extent: f64,
) -> VectorLineWithOffset {
    VectorLineWithOffset::new(offset, vl.iter().map(|p| vp_to_point(p, extent)).collect())
}

/// Vector MultiPolygon to Vec<VectorLines3DWithOffset>
fn vmp_to_ls_w_off_3d<D: MValueCompatible>(
    offsets: Option<&Vec<Vec<f64>>>,
    mp: &VectorMultiPolygon<D>,
    extent: f64,
) -> Vec<VectorLines3DWithOffset> {
    mp.iter()
        .enumerate()
        .map(|(i, l)| vml_to_ls_w_off_3d(offsets.and_then(|o| o.get(i)), l, extent))
        .collect()
}

/// Vector MultiLineString to VectorLines3DWithOffset
fn vml_to_ls_w_off_3d<D: MValueCompatible>(
    offsets: Option<&Vec<f64>>,
    vl: &VectorMultiLineString<D>,
    extent: f64,
) -> VectorLines3DWithOffset {
    vl.iter()
        .enumerate()
        .map(|(i, l)| {
            vl_to_ls_w_off_3d(
                offsets.and_then(|o| o.get(i).copied()).unwrap_or_default(),
                l,
                extent,
            )
        })
        .collect()
}

/// Vector LineString to VectorLine3DWithOffset
fn vl_to_ls_w_off_3d<D: MValueCompatible>(
    offset: f64,
    vl: &VectorLineString<D>,
    extent: f64,
) -> VectorLine3DWithOffset {
    VectorLine3DWithOffset::new(offset, vl.iter().map(|p| vp_to_point3d(p, extent)).collect())
}

fn vp_to_point<D: MValueCompatible>(vp: &VectorPoint<D>, extent: f64) -> Point {
    Point {
        x: round(vp.x * extent) as i32,
        y: round(vp.y * extent) as i32,
        m: vp.m.clone().map(|m| m.into()),
    }
}

fn vp_to_point3d<D: MValueCompatible>(vp: &VectorPoint<D>, extent: f64) -> Point3D {
    Point3D {
        x: round(vp.x * extent) as i32,
        y: round(vp.y * extent) as i32,
        z: round(vp.z.unwrap_or_default() * extent) as i32,
        m: vp.m.clone().map(|m| m.into()),
    }
}
