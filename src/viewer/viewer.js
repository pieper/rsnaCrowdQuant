import Files from './files';
import Tools from './tools';
import Commands from './commands';
import Menu from '../menu/menu';

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.$ = $;
cornerstoneTools.external.$ = $;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstone.external.$ = $;

const config = {
  maxWebWorkers: navigator.hardwareConcurrency || 1,
  startWebWorkersOnDemand: true,
  webWorkerPath: 'node_modules/cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderWebWorker.min.js',
  webWorkerTaskPaths: [],
  taskConfiguration: {
    decodeTask: {
      loadCodecsOnStartup: true,
      initializeCodecsOnStartup: false,
      codecsPath: 'cornerstoneWADOImageLoaderCodecs.js',
      usePDFJS: false,
      strict: false,
    }
  }
};

cornerstoneWADOImageLoader.webWorkerManager.initialize(config);

const IMAGE_LOADED_EVENT = 'cornerstoneimageloaded';

export default {
  $window: $(window),
  $viewer: $('.viewer-wrapper'),
  $overlay: $('.loading-overlay'),
  numImagesLoaded: 0,
  imageIdsToLoad: [],
  options: {},

  getNextCase(options={}) {
    this.options.onFinishedLoading = options.onFinishedLoading || function () {};
    this.$overlay.removeClass('invisible').addClass('loading');
    const enabledElement = cornerstone.getEnabledElement(this.element);

    Files.getCaseImages(options).then((imageIds) => {
        console.time('Loading All Images');
        
        if (! this.loadEventCallback) {
          this.loadEventCallback = function(event) {
            this.numImagesLoaded += 1;
            console.log(this.numImagesLoaded / this.imageIdsToLoad.length * 100);
            if (this.numImagesLoaded === this.imageIdsToLoad.length) {
              console.timeEnd('Loading All Images');
              this.options.onFinishedLoading();
            }
          };
          this.loadEventCallback = this.loadEventCallback.bind(this);
          cornerstone.events.addEventListener(IMAGE_LOADED_EVENT, this.loadEventCallback);
        }
        this.numImagesLoaded = 0;
        this.imageIdsToLoad = imageIds;

        cornerstone.loadImage(imageIds[0]).then((image) => {
            this.$overlay.removeClass('loading').addClass('invisible');

            // Set the default viewport parameters
            const viewport = cornerstone.getDefaultViewport(enabledElement.canvas, image);
            // e.g. lung window
            //viewport.voi.windowWidth = 1500;
            //viewport.voi.windowCenter = -300;

            cornerstone.displayImage(this.element, image, viewport);
            Tools.initTools(imageIds);
        });
    });
  },

  initViewer() {
    this.element = $('#cornerstoneViewport')[0];

    Menu.init();

    this.$viewer.removeClass('invisible');

    Tools.element = this.element;
    Commands.element = this.element;
    Menu.element = this.element;

    Commands.initCommands();

    // TODO: Debounce the call to cornerstone.resize so this doesn't fire
    // too often
    this.$window.on('resize', () => cornerstone.resize(this.element, true));

    cornerstone.enable(this.element);

    // currentSeriesIndex = 0;//a hack to get series in order
    this.getNextCase();

    // for testing and debugging
    window.rsnaCrowdQuant = window.rsnaCrowdQuant || {};
    window.rsnaCrowdQuant.viewer = this;
    window.rsnaCrowdQuant.files = Files;
    window.rsnaCrowdQuant.tools = Tools;
    window.rsnaCrowdQuant.commands = Commands;
    window.rsnaCrowdQuant.menu = Menu;
  },

  //
  // tests
  //
  //
  loadAllGroundTruth() {
    window.rsnaCrowdQuant.dbs.groundTruthDB.allDocs({include_docs: true}).then((groundTruthDocs) => {
      let processOneGroundTruth = function() {
        let row = groundTruthDocs.rows.pop();
        if (row) {
          window.rsnaCrowdQuant.files.getSeriesUIDForInstanceUID(row.doc.instanceUID).then((seriesUID) => {
            window.rsnaCrowdQuant.viewer.getNextCase({
              seriesUID: seriesUID, 
              onFinishedLoading: processOneGroundTruth
            });
          })
        } else {
          console.log('loaded all ground truth');
        }
      }
      processOneGroundTruth();
    })
  }
}
