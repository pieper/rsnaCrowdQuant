import Connector from './connector';
import Login from '../login/login';
import {chronicleURL, chronicleDB, measurementsDB} from '../db/db';

export default {
  getCaseImages(options={}) {
    const $overlay = $('.loading-overlay');
    $overlay.addClass('loading');
    $overlay.removeClass('invisible');

    let casePromise;
    if (options.seriesUID) {
      casePromise = this.getImageIDsForSeriesUID(options.seriesUID);
    } else {
      casePromise = this.getChronicleImageIDs();
    }

    return casePromise.then((caseStudy) => {
      if (!caseStudy || !caseStudy.urls) {
        throw new Error('No case study or no URLs provided');
      }

      // where to store the case id for access during save?
      // I don't understand the model hierarchy, so let's stick it on the window
      window.rsnaCrowdQuantSeriesUID = caseStudy.seriesUID;
      window.rsnaCrowdQuantCaseStudy = caseStudy;

      return caseStudy.urls.map(url => url.replace('http', 'wadouri'));
    });
  },

  currentSeriesIndex: undefined,
  seriesUID_A: undefined,

  getChronicleImageIDs () {
    var annotatorID = Login.username;
    return this.getNextSeriesForAnnotator(annotatorID
    ).then ((seriesUID) => {
      return this.getImageIDsForSeriesUID(seriesUID);
    });
  },

  getImageIDsForSeriesUID (seriesUID) {

    if(!this.currentSeriesIndex) {
      this.currentSeriesIndex = 0;
    }
    this.currentSeriesIndex++;
    console.log('series Index:', this.currentSeriesIndex);

    //const key = data.rows[this.currentSeriesIndex].key;

    // if(currentSeriesIndex >= data.rows.length){
    //   currentSeriesIndex=0;
    // }

    this.seriesUID_A = seriesUID;
    console.log('series UID:', seriesUID);

    return chronicleDB.query("instances/seriesInstances", {
      startkey : seriesUID,
      endkey : seriesUID + '\u9999',
      stale : 'update_after',
      reduce : false,
    }).then((data) => {
      // console.log('instance data:', data);
      const instanceUIDs = [];
      data.rows.forEach((row) => {
        const instanceUID = row.value[1];
        instanceUIDs.push(instanceUID);
      });

      console.time('Metadata Retrieval from Chronicle DB');
      // TODO: Switch to some study or series-level call
      // It is quite slow to wait on metadata for every single image
      // each retrieved in separate calls
      // TODO: for now this is used because we make no assumptions about
      // the contents of the database and we calculate on the fly.  Once the
      // set of series is defined we can precalculate anything we need
      // in order to optimize (e.g. here we are really only accessing
      // the dataset ocuments so we can sort them by image number).
      return Promise.all(instanceUIDs.map((uid) => {
        return chronicleDB.get(uid);
      }));
    }).then((docs) => {
      console.timeEnd('Metadata Retrieval from Chronicle DB');
      const instanceNumberTag = "00200013";
      let instanceUIDsByImageNumber = {};
      docs.forEach((doc) => {
        const imageNumber = Number(doc.dataset[instanceNumberTag].Value);
        instanceUIDsByImageNumber[imageNumber] = doc._id;
      });

      const imageNumbers = Object.keys(instanceUIDsByImageNumber);
      imageNumbers.sort((a, b) => a - b);

      let instanceURLs = [];
      let instanceUIDs = [];
      imageNumbers.forEach((imageNumber) => {
        const instanceUID = instanceUIDsByImageNumber[imageNumber];
        const instanceURL = `${chronicleURL}/${instanceUID}/object.dcm`;
        instanceURLs.push(instanceURL);
        instanceUIDs.push(instanceUID);
      });

      return {
        name: "default_case",
        seriesUID: this.seriesUID_A,
        currentSeriesIndex: this.currentSeriesIndex - 1,
        urls: instanceURLs,
        instanceUIDs
      };
    }).catch((err) => {
      throw err;
    });
  },

  getNextSeriesForAnnotator(annotatorID) {

    let measurementsPerSeries = {};
    let annotatorMeasuredSeries = {};
    let seriesUIDs = [];

    // first, get list of all series (this should be factored out to be global and only queried once)
    return chronicleDB.query('instances/context', {
      reduce: true,
      group: true,
      group_level: 3,
    }).then(function (result) {

      result.rows.forEach(row => {
        seriesUIDs.push(row.key[2][2]);
      });

      // then get the list of all measurements per series and how many measurements
      // (not all series will have been measured)
      return measurementsDB.query('by/seriesUID', {
        reduce: true,
        group: true,
        level: 'exact',
      })
    }).then(function (result) {
        result.rows.forEach(row => {
          measurementsPerSeries[row.key] = row.value;
        });

        return measurementsDB.query('by/annotators', {
          reduce: false,
          include_docs: true,
          start_key: annotatorID,
          end_key: annotatorID,
        })
    }).then(function (result) {

      result.rows.forEach(row => {
        annotatorMeasuredSeries[row.doc.seriesUID] = true;
      });

      // now reconcile the data
      // - look through each available series
      // -- if nobody has measured it then use it
      // - if the user already measured it, ignore it
      // - otherwise find the least measured one
      let leastMeasured = {seriesUID: undefined, measurementCount: Number.MAX_SAFE_INTEGER};
      for (let seriesIndex = 0; seriesIndex < seriesUIDs.length; seriesIndex++) {
        let seriesUID = seriesUIDs[seriesIndex];
        if ( ! (seriesUID in measurementsPerSeries) ) {
          return seriesUID;

        }
        if ( (! (seriesUID in annotatorMeasuredSeries)) &&
              (measurementsPerSeries[seriesUID] < leastMeasured.measurementCount) ) {
          leastMeasured.seriesUID = seriesUID;
          leastMeasured.measurementCount = measurementsPerSeries[seriesUID];
        }
      }
      return leastMeasured.seriesUID;
    }).catch((err) => {
      throw err;
    });
  },

  getSeriesUIDForInstanceUID (instanceUID) {
    return chronicleDB.get(instanceUID).then(function (result) {
      const seriesInstanceUIDTag = "0020000E";
      return(result.dataset[seriesInstanceUIDTag].Value);
    }).catch((err) => {
      throw err;
    });
  }
}
