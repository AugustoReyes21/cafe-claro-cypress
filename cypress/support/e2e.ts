import '@testing-library/cypress/add-commands';

// El seed se ejecuta antes de CADA prueba, incluso si la anterior falló.
beforeEach(() => {
  cy.request('POST', '/api/test/reset').its('body').should('deep.equal', {
    status: 'reset', products: 4, orders: 0
  });
});
