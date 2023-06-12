const fs = require('fs');
const { pipeline, Transform, PassThrough } = require('stream');
const https = require('https');
const zlib = require('zlib');
const archiver = require('archiver');




function httpsGet(hostname_, path_) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: hostname_,
      port: 443,
      path: path_,
      headers: {
        accept: 'application/json',
        // Authorization: 'Bearer xxxxxxxxxxxxx'
      },
    };

    const req = https.request(options, function (res) {
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const body = Buffer.concat(chunks);
        resolve(body);
      });
    });

    req.on('error', function (err) {
      reject(err);
    });

    req.end();
  });
}




class Throttle extends PassThrough {
  constructor(time) {
    super();
    this.delay = time;
  }

  _write(chunk, encoding, callback) {
    this.push(chunk);
    setTimeout(callback, this.delay);
  }
}




class MyTransform extends Transform {
  constructor() {
    super();
  }

  _transform(chunk, encoding, callback) {
    const data = JSON.parse(chunk.toString());
    const xml = this._convertToXML(data);
    this.push(xml);
    callback();
  }

  _convertToXML(data) {
    let xml = '<root>\n';
    data.forEach((item) => {
      xml += '<item>\n';
      for (const key in item) {
        xml += `<${key}>${item[key]}</${key}>\n`;
      }
      xml += '</item>\n';
    });
    xml += '</root>\n';
    return xml;
  }
}




function compressFilesToZip(filePaths, outputFilePath) {
  const output = fs.createWriteStream(outputFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);

    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop();
      archive.file(filePath, { name: fileName });
    }

    archive.finalize();
  });
}




async function main() {
  try {
    const data = await httpsGet('jsonplaceholder.typicode.com', '/todos');
    const input = new PassThrough();
    const throttle = new Throttle(1000);
    const transformStream = new MyTransform();

    const filesToCompress = ['data.json', 'data.xml'];
    const zipOutputFilePath = 'compressed.zip';

    input.end(data);

    await pipeline(
      input,
      throttle,
      transformStream,
      fs.createWriteStream('data.xml'),
      async (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('Data saved to data.xml');


        await fs.promises.writeFile('data.json', data);
        console.log('Data saved to data.json');

    
        await compressFilesToZip(filesToCompress, zipOutputFilePath);
        console.log(`Files compressed and saved as ${zipOutputFilePath}`);
      }
    );
  } catch (err) {
    console.error(err);
  }
}



main();  // node Task
