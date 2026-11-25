import { useState } from 'react';

/** The green / red message at the top of the tab; it hides by itself after a few seconds. */
export const useSettingsMessages = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const showMsg = (msg: string, type: 'error' | 'success' = 'success') => {
      if (type === 'error') {
          setErrorMessage(msg);
          setTimeout(() => setErrorMessage(''), 5000);
      } else {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(''), 3000);
      }
  };

  return { errorMessage, successMessage, showMsg };
};

export type ShowMsg = ReturnType<typeof useSettingsMessages>['showMsg'];
