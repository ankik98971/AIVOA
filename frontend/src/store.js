import { configureStore } from '@reduxjs/toolkit';
import complaintReducer from './features/complaintSlice';

export const store = configureStore({
  reducer: {
    complaint: complaintReducer,
  },
});
