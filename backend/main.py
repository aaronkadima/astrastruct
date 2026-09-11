"""AstraStruct optional backend.

The browser MVP does not depend on this service. This FastAPI entry point is the future
boundary for compiled/nonlinear solvers, persistence, jobs and collaboration.
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AstraStruct Solver API", version="0.1.0")

class Health(BaseModel):
    status: str
    solver_backend: str

@app.get('/health', response_model=Health)
def health():
    return Health(status='ok', solver_backend='browser-linear / future-wasm-hpc')

@app.get('/roadmap')
def roadmap():
    return {
        'planned': [
            'mixed 2D frame-truss', '3D frame', 'Timoshenko', 'P-Delta',
            'Newton-Raphson', 'plasticity', 'concrete damage/cracking', 'bond-slip',
            'contact', 'shell/solid elements', 'modal/transient dynamics', 'reliability'
        ]
    }
