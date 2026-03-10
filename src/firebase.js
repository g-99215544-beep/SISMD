import { initializeApp } from 'firebase/app';
import { getDatabase }   from 'firebase/database';

const firebaseConfig = {
  apiKey:            'AIzaSyAam8uHZivxN9wMos-AEPgb5UDPKkJV9Mc',
  authDomain:        'sismd-9153f.firebaseapp.com',
  databaseURL:       'https://sismd-9153f-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'sismd-9153f',
  storageBucket:     'sismd-9153f.firebasestorage.app',
  messagingSenderId: '52136487791',
  appId:             '1:52136487791:web:9cd966fad478ebd96fd69a',
  measurementId:     'G-N0E4Z2WECV',
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
