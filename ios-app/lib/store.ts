// Tiny in-memory handoff between the contacts screen and the tiers screen.
// Deliberately not persisted — it only needs to survive one navigation.

export type PickedContact = {
  id: string;
  name: string;
  phone: string;
};

let selected: PickedContact[] = [];

export function setSelectedContacts(contacts: PickedContact[]) {
  selected = contacts;
}

export function getSelectedContacts(): PickedContact[] {
  return selected;
}

export function clearSelectedContacts() {
  selected = [];
}
