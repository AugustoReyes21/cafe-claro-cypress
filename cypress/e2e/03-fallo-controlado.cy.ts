describe('Fallo controlado y recuperación', () => {
  it('recibe un 409 real por falta de stock, conserva el carrito y permite corregirlo', () => {
    cy.intercept('POST', '/api/orders').as('createOrder');
    cy.visit('/');
    cy.findByRole('button', { name: 'Agregar Croissant de mantequilla' }).click();
    cy.findByRole('spinbutton', { name: 'Cantidad de Croissant de mantequilla' }).clear().type('2').blur();
    // Otro cliente compra 7 de las 8 unidades después de que cargamos el catálogo.
    // cy.request llega al servidor real y no pasa por cy.intercept del navegador.
    cy.request('POST', '/api/orders', { items: [{ productId: 'croissant', quantity: 7 }] }).its('status').should('equal', 201);
    cy.findByRole('button', { name: 'Confirmar pedido' }).click();
    cy.wait('@createOrder').then(({ response }) => {
      expect(response?.statusCode).to.equal(409);
      expect(response?.body.code).to.equal('OUT_OF_STOCK');
    });
    cy.findByRole('alert').should('contain.text', 'No hay suficientes existencias').and('contain.text', 'Quedan 1');
    cy.findByRole('spinbutton', { name: 'Cantidad de Croissant de mantequilla' }).should('have.value', '2');
    cy.get('[data-cy="cart-total"]').should('have.text', 'Q 32.00');
    cy.findByRole('button', { name: 'Confirmar pedido' }).should('be.enabled');
    cy.screenshot('03-error-real-de-existencias', { capture: 'fullPage' });
    cy.findByRole('spinbutton', { name: 'Cantidad de Croissant de mantequilla' }).clear().type('1').blur();
    cy.findByRole('button', { name: 'Confirmar pedido' }).click();
    cy.wait('@createOrder').its('response.statusCode').should('equal', 201);
    cy.get('[data-cy="confirmed-total"]').should('have.text', 'Q 16.00');
    cy.findByRole('alert').should('not.exist');
    cy.get('[data-cy="order-id"]').invoke('text').then(id => {
      cy.request(`/api/orders/${id}`).its('body.totalCents').should('equal', 1600);
    });
    cy.screenshot('03-recuperacion-confirmada', { capture: 'fullPage' });
  });
});
