describe('Validación antes de enviar', () => {
  it('rechaza el carrito vacío sin enviar POST', () => {
    cy.intercept('POST', '/api/orders').as('createOrder');
    cy.visit('/');
    cy.findByRole('button', { name: 'Confirmar pedido' }).click();
    cy.findByRole('alert').should('contain.text', 'Tu pedido está vacío');
    cy.get('@createOrder.all').should('have.length', 0);
    cy.get('[data-cy="cart-total"]').should('have.text', 'Q 0.00');
    cy.findByRole('button', { name: 'Confirmar pedido' }).should('be.enabled');
    cy.screenshot('02-carrito-vacio-sin-solicitud', { capture: 'fullPage' });
  });

  it('rechaza cantidades no enteras y fuera del rango sin enviar POST', () => {
    cy.intercept('POST', '/api/orders').as('createOrder');
    cy.visit('/');
    cy.findByRole('button', { name: 'Agregar Latte de la casa' }).click();
    for (const quantity of ['0', '-1', '1.5', '11']) {
      cy.findByRole('spinbutton', { name: 'Cantidad de Latte de la casa' }).clear().type(quantity).blur();
      cy.findByRole('button', { name: 'Confirmar pedido' }).click();
      cy.findByRole('alert').should('contain.text', 'Usa cantidades enteras entre 1 y 10');
      cy.get('@createOrder.all').should('have.length', 0);
    }
    cy.findByRole('button', { name: 'Quitar Latte de la casa' }).click();
    cy.get('[data-cy="cart-total"]').should('have.text', 'Q 0.00');
    cy.findByRole('spinbutton', { name: 'Cantidad de Latte de la casa' }).should('not.exist');
  });
});
