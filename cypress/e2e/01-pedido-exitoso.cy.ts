describe('Camino exitoso', () => {
  it('confirma dos productos y conserva el identificador y Q 64.00 en SQLite', () => {
    cy.intercept('POST', '/api/orders').as('createOrder');
    cy.visit('/');
    cy.findByRole('button', { name: 'Agregar Chocolate caliente' }).should('be.disabled');
    cy.findByRole('button', { name: 'Agregar Latte de la casa' }).click();
    cy.findByRole('spinbutton', { name: 'Cantidad de Latte de la casa' }).clear().type('2').blur();
    cy.findByRole('button', { name: 'Agregar Croissant de mantequilla' }).click();
    cy.get('[data-cy="cart-total"]').should('have.text', 'Q 64.00');
    cy.findByRole('button', { name: 'Confirmar pedido' }).click();

    cy.wait('@createOrder').then(({ request, response }) => {
      expect(request.body).to.deep.equal({ items: [
        { productId: 'latte', quantity: 2 },
        { productId: 'croissant', quantity: 1 }
      ] });
      expect(response?.statusCode).to.equal(201);
      expect(response?.body.totalCents).to.equal(6400);
      const id: string = response?.body.id;
      expect(id).to.match(/^CAF-[0-9a-f-]{36}$/);
      cy.get('[data-cy="order-id"]').should('have.text', id);
      // Lectura posterior independiente: no basta con verificar el POST o la pantalla.
      cy.request(`/api/orders/${id}`).then(({ body }) => {
        expect(body.id).to.equal(id);
        expect(body.totalCents).to.equal(6400);
        expect(body.items.map((item: { quantity: number }) => item.quantity)).to.deep.equal([2, 1]);
      });
      cy.intercept('GET', `/api/orders/${id}`).as('readOrder');
      cy.reload();
      cy.wait('@readOrder').its('response.body.totalCents').should('equal', 6400);
      cy.get('[data-cy="order-id"]').should('have.text', id);
      cy.get('[data-cy="confirmed-total"]').should('have.text', 'Q 64.00');
    });
    cy.request('/api/products').then(({ body }) => {
      expect(body.find((p: { id: string }) => p.id === 'latte').stock).to.equal(10);
      expect(body.find((p: { id: string }) => p.id === 'croissant').stock).to.equal(7);
    });
    cy.screenshot('01-pedido-confirmado-y-persistido', { capture: 'fullPage' });
  });
});
