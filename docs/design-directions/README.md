# Front-end design directions

Candidate visual directions for the DepthViz forecast screen, as self-contained
interactive mocks. Open any file directly in a browser, no build step and no
network access required.

- `ripple.html`: the current front runner, and the only one drawn with real
  page chrome rather than presented inside a gallery frame. See below.
- `directions-01-05.html`: Bathymetric Instrument, Chart Room, Field Signal,
  Tide Ledger, Planning Matrix.
- `directions-06-10.html`: Sight Line, Verdict First, Dive Log, Barograph,
  Coast.

## Ripple

Drawn after a review of the first ten, which were all judged too rectilinear.
It is a deliberate reaction to four specific things: uppercase letterspaced
monospace micro-labels, hairline rules as the only separator, hard corners, and
data arranged as a ruled grid. In their place:

- no monospace anywhere, sentence-case labels, tabular numerals in the body
  face where figures line up
- two soft wide shadows and tinted panels instead of rules
- one radius scale of four steps plus a pill, applied to every surface and
  control
- a circular hero device and a single continuous curve for the week, rather
  than panels and bars

Alignment stays on the same 4pt grid as the other directions. The hero draws
rings every 2 m at the contrast each range would actually have, from the same
Beer-Lambert relation `src/lib/visibilityMath.ts` uses on dive video, over a
faint always-visible scale so the device never looks empty. The solid ring is
the sight line, and the water hue tracks the forecast: silt brown at 2.2 m,
blue-green at 11.2 m.

Unlike the gallery files, this one includes the surrounding page: a header, a
footer with attribution and legal links, and a floating navigation dock.

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
