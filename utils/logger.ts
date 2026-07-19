import React from 'react';

const globalLogs: string[] = [];

export const createLogger = (namespace: string) => {
  const log = (msg: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const entry = data ? `${timestamp} [${namespace}] ${msg} ${JSON.stringify(data)}` : `${timestamp} [${namespace}] ${msg}`;
    globalLogs.push(entry);
    console.log(entry);
  };
  const error = (msg: string, err?: any) => {
    const timestamp = new Date().toISOString();
    const entry = err ? `${timestamp} [${namespace}] ERROR ${msg} ${err}` : `${timestamp} [${namespace}] ERROR ${msg}`;
    globalLogs.push(entry);
    console.error(entry);
  };
  const getLogs = () => globalLogs;
  return { log, error, getLogs };
};

// Hook version for React components
export const useLogger = (namespace: string) => {
  return React.useMemo(() => createLogger(namespace), [namespace]);
};
