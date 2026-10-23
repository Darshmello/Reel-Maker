import React from 'react';
import {Composition} from 'remotion';
import {S00_Cube} from './scenes/S00_Cube';

export const Root: React.FC = () => (
  <>
    <Composition id="WhatIf" component={S00_Cube} width={1080} height={1920} fps={30} durationInFrames={1080} />
    <Composition id="Cube" component={S00_Cube} width={1080} height={1920} fps={30} durationInFrames={90} />
  </>
);
