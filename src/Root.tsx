import React from 'react';
import {Composition} from 'remotion';
import {S00_Cube} from './scenes/S00_Cube';
import {StyleFrame} from './scenes/StyleFrame';

export const Root: React.FC = () => (
  <>
    <Composition id="WhatIf" component={StyleFrame} width={1080} height={1920} fps={30} durationInFrames={1080} defaultProps={{seed: 'city-01', camZ: 12}} />
    <Composition id="StyleFrame" component={StyleFrame} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{seed: 'city-01', camZ: 12}} />
    <Composition id="Cube" component={S00_Cube} width={1080} height={1920} fps={30} durationInFrames={90} />
  </>
);
