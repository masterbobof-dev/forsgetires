import { useState } from 'react';

/** The two messages at the top of the tab: red (an error, hides after 6 s) and green (done). */
export const useMessages = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };
  return { errorMessage, successMessage, setSuccessMessage, showError };
};

export type Messages = ReturnType<typeof useMessages>;
