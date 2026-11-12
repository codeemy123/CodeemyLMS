if (process.env.WORKER_TASK === 'assessments') await import('./finalize-assessments.mjs');
else if (process.env.WORKER_TASK === 'recordings') await import('./transfer-zoom-recordings.mjs');
else throw new Error('Set WORKER_TASK to assessments or recordings.');
