# Front-end design directions

Ten candidate visual directions for the DepthViz forecast screen, as
self-contained interactive mocks. Open either file directly in a browser, no
build step and no network access required.

- `directions-01-05.html`: Bathymetric Instrument, Chart Room, Field Signal,
  Tide Ledger, Planning Matrix.
- `directions-06-10.html`: Sight Line, Verdict First, Dive Log, Barograph,
  Coast.

Both galleries render the same sample forecast for Hope Cove, South Devon, so
the directions can be compared like for like. The arithmetic is consistent
throughout: a 14.0 m baseline clarity for the site, less six weighted
penalties, gives the visibility shown. In `directions-06-10.html` the Coast
direction scores each site from the same day's conditions through its own
exposure weights, which is why the ranking reorders across the week.

Everything here is sample data. The diver reports and the dive history are
illustrative, not real people and not a real forecast.

Each direction carries its own notes: palette with hex values, type pairing and
the face it would ship with, the central device it is built around, its
trade-off, and what adopting it would commit the project to. Interactions work:
day selection, unit switching, disclosure, site selection, and the loading
treatment via the refresh control.

These are mocks for choosing a direction, not production code. Nothing in here
is imported by the app, and the shared shell in each file exists only to present
the mocks side by side. See `DESIGN.md` for the constraints every direction has
to satisfy.
