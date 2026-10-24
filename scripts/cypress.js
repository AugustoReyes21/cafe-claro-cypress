import cypress from 'cypress';

// Terminales basadas en Electron pueden heredar esta variable y romper Cypress.
delete process.env.ELECTRON_RUN_AS_NODE;
const [command = 'run', ...args] = process.argv.slice(2);
if (command === 'open') {
  await cypress.open();
} else {
  const options = await cypress.cli.parseRunArguments(['cypress', 'run', ...args]);
  const result = await cypress.run(options);
  process.exitCode = result.failures || result.totalFailed || 0;
}
