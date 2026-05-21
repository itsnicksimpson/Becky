import { DialogComponent, DialogOpenEvent } from '@theme/dialog';

/**
 * A custom element that manages a subscription management sidebar.
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog - The dialog element.
 *
 * @extends {DialogComponent}
 */
class SubscriptionSidebarComponent extends DialogComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener(DialogOpenEvent.eventName, this.#handleOpen);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(DialogOpenEvent.eventName, this.#handleOpen);
  }

  #handleOpen = () => {
    // Any initialization logic when sidebar opens
  };

  open() {
    this.showDialog();
  }

  close() {
    this.closeDialog();
  }
}

if (!customElements.get('subscription-sidebar-component')) {
  customElements.define('subscription-sidebar-component', SubscriptionSidebarComponent);
}



