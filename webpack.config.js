const pkgjson = require("./package.json");
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const {
  BundleAnalyzerPlugin
} = require('webpack-bundle-analyzer');
const ManifestPlugin = require('webpack-manifest-plugin');
const ExtractTextWebpackPlugin = require('extract-text-webpack-plugin');
const autoprefixer = require('autoprefixer');

const generateExternals = (pkgs) => {

  let peers = _.keys(pkgjson.peerDependencies);

  let genpkg = {};
  for (var i = 0; i < peers.length; i++) {
    const val = peers[i];

    genpkg[val] = {
      root: val,
      commonjs2: val,
      commonjs: val,
      amd: val,
      umd: val,
      ...pkgs[val]
    };

  }

  return genpkg;
}


const referenceDLLs = () => {

  let deps = _.keys(pkgjson.dependencies);

  const dlls = [];
  const mountpoints = {};

  for (var i = 0; i < deps.length; i++) {
    const dep = deps[i];

    const depPath = path.join('node_modules', dep);
    const deppkgjson = require('./' + path.join(depPath, 'package.json'));

    if (deppkgjson.mountpoint) {

      if (mountpoints[deppkgjson.mountpoint]) {
        throw new Error("DUPLICATED_MOUNTPOINT");
      }

      try {

        const manifest = require('./' + path.join(depPath, 'dist', 'manifest.json'));

        mountpoints[deppkgjson.mountpoint] = {
          manifest,
          package: dep
        };

        const libPath = path.join(depPath, 'dist', 'lib.json');

        if (fs.existsSync(libPath)) {
          console.log("DLL " + dep + "  =>   " + deppkgjson.mountpoint);
          dlls.push(new webpack.DllReferencePlugin({
            manifest: require('./' + path.join(depPath, 'dist', 'lib.json'))
          }));
        }

        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist');
        }

        fs.writeFileSync(path.join('dist', 'mountpoints.json'), JSON.stringify(mountpoints, null, 2))
      } catch (err) {
        console.warn("ERROR: " + dep);
        console.warn(err.message);
      }

    }
  }

  //console.log("Production mount points");
  //console.log(JSON.stringify(mountpoints, null, 2));

  return dlls;
}



class CompilerPlugin {
  constructor(options) {
    this.options = options;
  }
  apply(compiler) {

    compiler.plugin("after-emit", (compilation, cb) => {
      const mountpoints = JSON.parse(fs.readFileSync('./dist/mountpoints.json', 'utf8'));
      const manifest = JSON.parse(fs.readFileSync('./dist/manifest.json', 'utf8'));

      //console.log("Adding app mountpoint")

      mountpoints.app = {
        manifest,
        package: pkgjson.name
      };

      fs.writeFileSync('./dist/mountpoints.json', JSON.stringify(mountpoints, null, 2));
      //console.log("mountpoint...added")
      cb();
    });

  }
};

module.exports = (env = {}) => {

  const _TARGET = "web";
  const __ANALYZE__ = env.analyze;
  const __DEV__ = env.development;
  const __PROD__ = env.production || __ANALYZE__;

  if (__PROD__ === __DEV__) {
    throw new Error("Production or development configuration must be selected");
  }

  let _ENV = null;
  if (__PROD__) {
    _ENV = 'production';
  }

  if (__DEV__) {
    _ENV = 'development';
  }

  /****************************************************************************/
  let entry = {};
  entry['index'] = __dirname + '/src/index.jsx';
  entry = {
    ...entry
  };


  /****************************************************************************/
  let plugins = [
    new CompilerPlugin(),
    ...referenceDLLs(),
    new ManifestPlugin(),
    new webpack.DefinePlugin({
      "process.env": {
        "NODE_ENV": JSON.stringify(_ENV),
        "BUILD_TARGET": JSON.stringify(_TARGET)
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'chunks',
      minChunks: Infinity,
    })
  ];

  if (__PROD__) {
    plugins.push(new webpack.optimize.UglifyJsPlugin());
  }

  if (__DEV__) {
    plugins.push(new webpack.NamedModulesPlugin());
    plugins.push(new webpack.NoEmitOnErrorsPlugin());
  }

  if (__ANALYZE__) {
    plugins.push(new BundleAnalyzerPlugin());
  }

  /***************************************************************************/
  let rules = [{
    test: /\.jsx$/,
    loader: 'babel-loader',
    include: [path.resolve(__dirname, 'src')]
  }];

  /***************************************************************************/
  let node = {};

  /***************************************************************************/
  let externals = generateExternals({
    react: {
      root: 'React'
    }
  });

  return {
    target: _TARGET,
    entry,
    output: {
      path: __dirname + '/dist',
      filename: '[name].js',
      libraryTarget: 'umd'
    },
    module: {
      rules
    },
    plugins,
    resolve: {
      modules: [
        path.resolve(__dirname, 'src'),
        'node_modules'
      ],
      extensions: ['.js', '.jsx', '.json']
    },
    devtool: (__DEV__) ? 'cheap-module-source-map' : false,
    externals,
    node
  };
}
