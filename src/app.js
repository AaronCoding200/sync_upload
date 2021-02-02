import React, { useState, useRef } from 'react';
import { uploadFile, getSign, uploadPart, merge } from './server';
import webworkContent from './webwork';

let createURL = null;
let worker = null;

let filename;
let check;

let file;

const TCP_MAX = 4;

const App = () => {
  const [radioValue, setRadioValue] = useState(false);
  const fileRef = useRef(null);

  // 创建一个新的线程
  const newWorker = () => {
    const textContent = webworkContent();
    const blob = new Blob([textContent]);
    createURL = window.URL.createObjectURL(blob);
    worker = new Worker(createURL);
  }

  // 上传
  const upload = async () => {
    file = fileRef.current.files[0];
    console.log(file)
    fileRef.current.value = null;
    filename = file.name;

    if (!file) return;

    if (!worker) {
      newWorker();
    };

    if (!radioValue) {
      // 非增量同步
      // ① 计算sign
      worker.onmessage = async (e) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sign', e.data.result);
        formData.append('filename', filename);

        // ② 上传原文件，sign文件到后台服务
        await uploadFile(formData);
      };
      worker.postMessage({ file, type: 'GET_SIGN' });
    } else {
      // 增量同步
      // ① 首先获取sign
      const { sign } = await getSign(filename);
      console.log(sign)
      // ② 然后根据sign计算出delta
      worker.onmessage = (e) => {
        const { blobArr, checkResult } = e.data.result;
        // checkResult： 差异sign
        console.log('checkResult: ', checkResult)
        // blobArr: 差异数据
        console.log('blobArr: ', blobArr)
        // 保存校验结果
        check = checkResult;
        // ③ 上传分片
        uploadBlobPart(0, blobArr);
      };

      worker.postMessage({ sign, file, type: 'GET_DELTA' });
    }
  };

  // 递归上传分片
  const uploadBlobPart = async (index, blobArr) => {
    let num = index; // 差异数据块数组下标
    let tcp_num = 0; // 新文件内容字节下标
    const uploadPartArr = [];
    // 开始滚动校验，每次移动一个字节，每块TCP_MAX个字节
    while (tcp_num < TCP_MAX) {
      if (!blobArr[num]) {
        break;
      }

      // 构建formData
      const formData = new FormData();
      formData.append('file', blobArr[num].blob);
      formData.append('i', blobArr[num].i);
      formData.append('filename', filename);

      // 构建上传方法
      const uploadFunc = () => {
        return new Promise(async (res) => {
          // 上传差异分片
          const { code } = await uploadPart(formData);
          res(code);
        });
      };

      uploadPartArr.push(uploadFunc);

      // 叠加
      num++;
      tcp_num++;
    };

    console.log('uploadPartArr', uploadPartArr)

    // 执行数组中的上传方法
    const result = await Promise.all(uploadPartArr.map(v => v()));
    result.map((v) => {
      if (v === 1) {
        console.log('上传片段成功');
      } else {
        throw new Error('上传失败');
      }
      return null;
    });

    if (num < blobArr.length) {
      // 如果差异分片没有上传完成，继续上传差异分片
      uploadBlobPart(num, blobArr);
    } else {
      // 全部上传完毕，开始合并
      console.log('上传完成');
      worker.onmessage = async (e) => {
        const sign = e.data.result;
        // 合并文件，获取最新的sign重新上传到后台
        const { code } = await merge({ filename, checkResult: check, sign });
        if (code === 1) {
          console.log('更新成功')
        } else {
          console.log('更新失败');
        }
      }

      worker.postMessage({ file, type: 'GET_SIGN' });
    }
  }


  return (
    <>
      <div>
        <input type="checkbox" checked={radioValue} onChange={() => setRadioValue(!radioValue)} />
      rsync
      </div>
      <input type="file" onChange={upload} ref={fileRef} />
    </>
  )
};

export default App;