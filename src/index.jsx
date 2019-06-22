import React from "react";
//import introspectionResult from '@nebulario/tracker-graph/dist/fragmentTypes.json';

import 'jquery'
import 'bootstrap';

window.$ = window.jQuery = require('jquery');
const {urls: {
    graphql,
    events
  }} = window.__CONFIG__;

import {RenderStateful} from '@nebulario/tracker-stateful-web'
import App, {reducers, watchers, clientState} from "@nebulario/tracker-common/dist/web";

RenderStateful({
  App,
  urls: {
    graphql,
    events
  },
  watchers,
  reducers,
  clientState,
  introspectionResult: {"__schema":{"types":[]}}
});
