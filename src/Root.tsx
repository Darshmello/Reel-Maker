import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {S00_Cube} from './scenes/S00_Cube';
import {StyleFrame} from './scenes/StyleFrame';
import {M2Dolly} from './scenes/M2Dolly';
import {Film, FilmProps} from './film/Film';
import {FPS, Spec, Word} from './film/beats';
import ideas from '../ideas.json';
import words from './film/words.json';

// Studio/default props: the first idea with its aligned words. Renders pass --props from scripts/render.ps1.
const defaults: FilmProps = {spec: (ideas as Spec[])[0], words: words as Word[], audio: null};

const metadata: CalculateMetadataFunction<FilmProps> = ({props}) => ({durationInFrames: Math.round(props.spec.duration * FPS)});

export const Root: React.FC = () => (
  <>
    <Composition id="WhatIf" component={Film} width={1080} height={1920} fps={FPS} durationInFrames={1080} defaultProps={defaults} calculateMetadata={metadata} />
    <Composition id="M2Dolly" component={M2Dolly} width={1080} height={1920} fps={30} durationInFrames={240} />
    <Composition id="StyleFrame" component={StyleFrame} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{seed: 'city-01', camZ: 12}} />
    <Composition id="Cube" component={S00_Cube} width={1080} height={1920} fps={30} durationInFrames={90} />
  </>
);
