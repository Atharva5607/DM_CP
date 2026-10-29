# Future scope

**Modelling**
- Probabilistic failures: replace fixed strengths with failure probabilities and estimate expected loss by Monte Carlo over many cascades.
- Time-stepped simulation with repairs in progress, so health recovers over hours instead of a single before and after.
- Capacity and flow models: power load balancing, hospital bed occupancy, traffic congestion as weights that change with load.
- N-2 and N-k screening using the counting already in place, with pruning for larger cities.
- Learned dependency strengths from outage histories.

**Data and integration**
- Import real networks from GIS and OpenStreetMap, and live feeds from SCADA, traffic and hospital systems.
- Persistence in PostgreSQL with a graph extension, scenario versioning and audit history.
- Multi-user workspaces with roles for each infrastructure owner.

**Algorithms**
- Exact or better colouring for repair scheduling, and min-cost flow for crew routing.
- Max-flow and min-cut to find the cheapest set of links whose loss disconnects a hospital.
- Community detection to find tightly coupled clusters across layers.

**Product**
- Map view with geographic layers and a time slider.
- Exportable incident reports (PDF) and a public API for emergency operations centres.
- Optimisation of where to add redundancy (new links, backup power) for the greatest risk reduction per cost.
