const { createRoot } = ReactDOM;

function App() {
    return (
        <div className="p-10">
            <h1 className="text-4xl font-bold text-white">System Check: Online</h1>
            <p className="text-slate-400">React environment is functioning correctly.</p>
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
