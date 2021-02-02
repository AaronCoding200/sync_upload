import axios from 'axios';

const api = axios.create({
  headers: {
    'content-type': 'multipart/form-data'
  }
});

// 全量上传文件到服务端
export const uploadFile = async (formData) => {
  const { data } = await api.post('/upload', formData);
  const { code } = data;
  return { code };
};

// 从服务端获取sign
export const getSign = async (filename) => {
  const { data } = await axios.get('/getSign', {
    params: { filename }
  });
  const { sign } = data;
  return { sign };
}

// 向服务端上传分片
export const uploadPart = async (formData) => {
  const { data } = await api.post('/upload_part', formData);

  const { code } = data;
  return { code };
};

// 合并文件
export const merge = async (params) => {
  const { data } = await axios.post('/merge', params);

  const { code } = data;
  return { code };
};