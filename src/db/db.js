// const baseUrl='http://127.0.0.1:5984';
import PouchDB from 'pouchdb';

//const baseURL='http://rsnacrowdquant.cloudapp.net:5984';
const baseURL='http://rsnacrowdquant2.eastus2.cloudapp.azure.com:5984';

export const uuidURL = `${baseURL}/_uuids`;
export const annotatorsURL = `${baseURL}/annotators`;
export const adjectivesURL = `${baseURL}/adjectives`;
export const animalsURL = `${baseURL}/animals`;
//export const chronicleURL = `${baseURL}/chronicle`;
export const chronicleURL = `${baseURL}/compressed-chronicle`;
export const measurementsURL = `${baseURL}/measurements`;
export const groundTruthURL = `${baseURL}/ground_truth`;


// console.log('url:', uuidUrl);

// export const uuidDB = new PouchDB(uuidURL);
export const adjectivesDB = new PouchDB(adjectivesURL);
export const animalsDB = new PouchDB(animalsURL);
export const annotatorsDB = new PouchDB(annotatorsURL);
export const chronicleDB = new PouchDB(chronicleURL);
export const measurementsDB = new PouchDB(measurementsURL);
export const groundTruthDB = new PouchDB(groundTruthURL);

// for testing and debugging
window.rsnaCrowdQuant = window.rsnaCrowdQuant || {};
window.rsnaCrowdQuant.dbs = {
  annotatorsDB,
  chronicleDB,
  measurementsDB,
  groundTruthDB,
};

export const getUUID = () => {
  return new Promise((resolve, reject) => {
    $.get(uuidURL, ({uuids}) => {resolve(uuids[0])});
      // const uuid = doc.uuids[0];
      // console.log('uuid:', uuid);
  });
}
