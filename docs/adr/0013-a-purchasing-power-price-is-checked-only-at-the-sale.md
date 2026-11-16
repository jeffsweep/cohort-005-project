# A purchasing-power price is checked only at the sale

Every purchase stores the country it was made from (`purchases.country`), so anyone can say afterwards what it was sold at, and a refund gives back what was paid. That country matters only when buying, and when claiming a Seat. After that, a Student with a discounted purchase watches the course from anywhere: a Student on holiday must not lose a course they paid for.

## Considered Options

- **A discounted purchase only plays in the country it was bought in.** We did this, to stop buying cheap through a VPN and then watching from anywhere. Dropped: it locked out honest Students whenever they travelled, and a VPN gets round it anyway.
- **A holiday allowance (say 30 days away).** Rejected: it keeps the lock and adds a clock to it.

## Consequences

A purchase made before the country column existed has no country, and there is no way to recover it.
