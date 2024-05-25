import { BaseVectorLayer, BaseVectorPointsFeature } from '../../src';
import { describe, expect, it } from 'bun:test';

describe('BaseVectorLayer', () => {
  const layer = new BaseVectorLayer();
  const feature = new BaseVectorPointsFeature([{ x: 0, y: 0 }], { name: 'a' }, 1);

  it('should be an instance of BaseVectorLayer', () => {
    expect(layer).toBeInstanceOf(BaseVectorLayer);
  });

  // add a feature
  it('should add a feature', () => {
    layer.addFeature(feature);
    expect(layer.features).toEqual([feature]);
  });

  // grab the feature
  it('should grab the feature', () => {
    expect(layer.feature(0)).toEqual(feature);
  });
  // get length
  it('should get length', () => {
    expect(layer.length).toEqual(1);
  });
});
