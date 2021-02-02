const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const SIZE = 2048;

router.get('/test', (req, res) => {
  return res.json({ test: 2 })
});

// 全量上传文件到files目录下
router.post('/upload', (req, res) => {
  const { file } = req;
  const { sign, filename } = req.body;
  const dirName = path.dirname(__dirname);
  const sourcePath = path.join(dirName, file.path);
  const destPath = path.join(__dirname, 'files/' + filename);
  const textPath = path.join(__dirname, 'files/' + filename + '.txt');

  fs.renameSync(sourcePath, destPath);
  fs.writeFileSync(textPath, sign);

  return res.json({ code: 1 });
});

// 获取sigh信息
router.get('/getSign', (req, res) => {
  const { filename } = req.query;
  const sign = fs.readFileSync(__dirname + '/files/' + filename + '.txt');

  return res.json({ code: 1, sign: sign.toString() });
});

// 上传差异分片到cache下
router.post('/upload_part', (req, res) => {
  const { i, filename } = req.body;
  console.log('upload_part:', i, ' ',filename)
  const { file } = req;

  console.log(file);

  const dirName = path.dirname(__dirname);
  const sourcePath = path.join(dirName, file.path);
  const destPath = path.join(__dirname, 'cache/' + filename + '-' + i);

  fs.renameSync(sourcePath, destPath);

  return res.json({ code: 1 });
});

// 合并文件
router.post('/merge', (req, res) => {
  const { checkResult, filename, sign } = req.body;
  console.log('merge--------------------------')
  console.log('checkResult:', checkResult)
  console.log('filename:', filename)
  console.log('sign:', sign)

  // 将文件读成buffer
  const sourceBuffer = fs.readFileSync(__dirname + '/files/' + filename);
  // 组成最新的数组
  const bufferArray = [];

  //   [ 0, 1 ],
  //   null,
  //   [ 2, 3 ],
  //   null,
  //   4,
  //   null,
  //   0,
  //   null,
  //   4,
  //   null

  for (let i = 0; i < checkResult.length; i++) {
    if (checkResult[i] || checkResult[i]===0) {
      if (typeof checkResult[i] === 'object') {
        // 0:[0,1], 2:[2,3],
        const [start, end] = checkResult[i];
        bufferArray.push(sourceBuffer.slice(start * SIZE, (end + 1) * SIZE));
      } else {
        // 4:4,6:0,8:4
        const index = checkResult[i];
        bufferArray.push(sourceBuffer.slice(index * SIZE, (index + 1) * SIZE));
      }
    } else {
      // 1:null,3:null,5:null,7:null,9:null
      const cachePath = __dirname + '/cache/' + filename + '-' + i;
      bufferArray.push(fs.readFileSync(cachePath));
      fs.unlink(cachePath, () => { });
    }
  }

  console.log('bufferArray:', bufferArray)

  const newBuffer = Buffer.concat(bufferArray);
  // 将构建好的分片数组进行文件合并
  fs.writeFileSync(__dirname + '/files/' + filename, newBuffer);
  // 将最新sign写入txt
  fs.writeFileSync(__dirname + '/files/' + filename + '.txt', sign);

  return res.json({ code: 1 });
});

module.exports = router;