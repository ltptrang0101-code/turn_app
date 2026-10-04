
import React, { useEffect, useState } from "react";
import "./App.css";

const STORAGE_KEY = "nail-salon-call-system-v3";

const INITIAL_TECHNICIANS = [
  { id: "anna", name: "Anna" },
  { id: "dee", name: "Dee" },
  { id: "tony", name: "Tony" },
  { id: "lee", name: "Lee" },
  { id: "q", name: "Q" },
];

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialData() {
  return {
    technicians: INITIAL_TECHNICIANS,
    standby: [],
    turnPosition: [],
    starredIds: [],
    history: [],
    archive: [],
    standbyVisible: true,
    businessDate: todayString(),
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createInitialData();

    const parsed = JSON.parse(saved);
    const initial = createInitialData();

    return {
      ...initial,
      ...parsed,
      technicians: Array.isArray(parsed.technicians)
        ? parsed.technicians
        : initial.technicians,
      standby: Array.isArray(parsed.standby) ? parsed.standby : [],
      turnPosition: Array.isArray(parsed.turnPosition)
        ? parsed.turnPosition
        : [],
      starredIds: Array.isArray(parsed.starredIds)
        ? parsed.starredIds
        : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    };
  } catch {
    return createInitialData();
  }
}

function moveItem(list, index, direction) {
  const result = [...list];
  const destination = index + direction;

  if (destination < 0 || destination >= result.length) {
    return result;
  }

  [result[index], result[destination]] = [
    result[destination],
    result[index],
  ];

  return result;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString();
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingOrder, setEditingOrder] = useState(false);
  const [confirmNewDay, setConfirmNewDay] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  function notify(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2800);
  }

  function getTechnician(id, technicians = data.technicians) {
    return technicians.find((tech) => tech.id === id);
  }

  // TECHNICIANS
  function addTechnician(event) {
    event.preventDefault();

    const name = newName.trim();

    if (!name) {
      notify("Please enter a technician name.");
      return;
    }

    if (
      data.technicians.some(
        (tech) => tech.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      notify("This technician already exists.");
      return;
    }

    const id =
      "tech-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7);

    setData((previous) => ({
      ...previous,
      technicians: [...previous.technicians, { id, name }],
    }));

    setNewName("");
    notify(`${name} added.`);
  }

  function beginEditName(tech) {
    setEditingId(tech.id);
    setEditingName(tech.name);
  }

  function saveTechnicianName(id) {
    const name = editingName.trim();

    if (!name) {
      notify("Name cannot be empty.");
      return;
    }

    const duplicate = data.technicians.some(
      (tech) =>
        tech.id !== id &&
        tech.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      notify("This name is already in use.");
      return;
    }

    setData((previous) => ({
      ...previous,
      technicians: previous.technicians.map((tech) =>
        tech.id === id ? { ...tech, name } : tech
      ),
    }));

    setEditingId(null);
    setEditingName("");
    notify("Technician name updated.");
  }

  function deleteTechnician(id) {
    const tech = getTechnician(id);
    if (!tech) return;

    const confirmed = window.confirm(
      `Remove ${tech.name} from the active technician list?`
    );

    if (!confirmed) return;

    setData((previous) => ({
      ...previous,
      technicians: previous.technicians.filter(
        (tech) => tech.id !== id
      ),
      standby: previous.standby.filter((item) => item !== id),
      turnPosition: previous.turnPosition.filter(
        (item) => item !== id
      ),
      starredIds: previous.starredIds.filter((item) => item !== id),
    }));

    setEditingId(null);
    notify(`${tech.name} removed from active lists.`);
  }

  // STANDBY
  // Adding or reordering Standby never changes Turn Position.
  function addToStandby(id) {
    if (data.standby.includes(id)) {
      notify("This technician is already in Standby.");
      return;
    }

    setData((previous) => ({
      ...previous,
      standby: [...previous.standby, id],
    }));
  }

  function removeFromStandby(id) {
    setData((previous) => ({
      ...previous,
      standby: previous.standby.filter((item) => item !== id),
    }));
  }

  function moveStandby(index, direction) {
    setData((previous) => ({
      ...previous,
      standby: moveItem(previous.standby, index, direction),
    }));
  }

  // STAR MARKER
  // The star is displayed only in Turn Position.
  function toggleStar(id) {
    setData((previous) => ({
      ...previous,
      starredIds: previous.starredIds.includes(id)
        ? previous.starredIds.filter((item) => item !== id)
        : [...previous.starredIds, id],
    }));
  }

  // CALL
  // Works from either Technicians or Standby.
  // Records every call and moves the called technician to the bottom
  // of Turn Position. Standby itself is not reordered or removed.
  function callTechnician(id) {
    const tech = getTechnician(id);

    if (!tech) {
      notify("Technician not found.");
      return;
    }

    setData((previous) => {
      const beforePosition = [...previous.turnPosition];

      const currentPosition = previous.turnPosition.filter(
        (item) => item !== id
      );

      // If the technician has never been called today, add them.
      // If they are already present, move them to the bottom.
      const nextPosition = [...currentPosition, id];

      const timestamp = new Date().toISOString();

      const entry = {
        id:
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 7),
        techId: id,
        techName: tech.name,
        turnNo: previous.history.length + 1,
        timestamp,
        beforePosition,
      };

      return {
        ...previous,
        turnPosition: nextPosition,
        history: [...previous.history, entry],
        // Keep Standby exactly as it was.
        standby: previous.standby,
      };
    });

    notify(`${tech.name} called and moved to the bottom.`);
  }

  // TURN POSITION MANUAL EDITING
  function moveTurnPosition(index, direction) {
    setData((previous) => ({
      ...previous,
      turnPosition: moveItem(
        previous.turnPosition,
        index,
        direction
      ),
    }));
  }

  // UNDO restores the exact position before the last call.
  // Manual edits made after that call are therefore also reverted.
  function undoLastCall() {
    if (data.history.length === 0) {
      notify("There is no call to undo.");
      return;
    }

    const lastEntry = data.history[data.history.length - 1];

    setData((previous) => ({
      ...previous,
      history: previous.history.slice(0, -1),
      turnPosition: Array.isArray(lastEntry.beforePosition)
        ? lastEntry.beforePosition.filter((id) =>
            previous.technicians.some((tech) => tech.id === id)
          )
        : previous.turnPosition,
    }));

    notify(`Last call for ${lastEntry.techName} undone.`);
  }

  // NEW DAY
  function startNewDay() {
    setData((previous) => {
      const archiveEntry = {
        id:
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 7),
        date: previous.businessDate,
        history: previous.history,
      };

      return {
        ...previous,
        archive:
          previous.history.length > 0
            ? [archiveEntry, ...previous.archive]
            : previous.archive,
        history: [],
        standby: [],
        turnPosition: [],
        starredIds: [],
        standbyVisible: true,
        businessDate: todayString(),
      };
    });

    setEditingOrder(false);
    setConfirmNewDay(false);
    notify("New day started. Turn Position is now empty.");
  }

  const availableForStandby = data.technicians.filter(
    (tech) => !data.standby.includes(tech.id)
  );

  const activeStandbyTechnicians = data.standby
    .map((id) => getTechnician(id))
    .filter(Boolean);

  const activeTurnTechnicians = data.turnPosition
    .map((id) => getTechnician(id))
    .filter(Boolean);

  const availableArchiveDays = data.archive;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Nail Salon Call Manager</h1>
          <p className="subtitle">
            Manage technicians, Standby, and live Turn Position.
          </p>
        </div>

        <div className="date-chip">
          Business date: {data.businessDate}
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      <main className="main-grid">
        {/* 1. TECHNICIANS */}
        <section className="card">
          <div className="card-head">
            <h2>1. Technicians</h2>
            <span className="count">
              {data.technicians.length} technicians
            </span>
          </div>

          <form className="form-row" onSubmit={addTechnician}>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Enter technician name"
              aria-label="New technician name"
            />
            <button className="btn-primary" type="submit">
              + Add
            </button>
          </form>

          {data.technicians.length === 0 ? (
            <div className="empty">No technicians added yet.</div>
          ) : (
            <div className="list">
              {data.technicians.map((tech) => (
                <div className="item" key={tech.id}>
                  {editingId === tech.id ? (
                    <>
                      <input
                        value={editingName}
                        onChange={(event) =>
                          setEditingName(event.target.value)
                        }
                        aria-label="Edit technician name"
                      />
                      <div className="btn-row">
                        <button
                          className="btn-primary btn-small"
                          onClick={() => saveTechnicianName(tech.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn-light btn-small"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="item-name">{tech.name}</span>

                      <div className="btn-row">
                        <button
                          className="btn-call"
                          onClick={() => callTechnician(tech.id)}
                        >
                          CALL
                        </button>

                        <button
                          className="btn-light btn-small"
                          onClick={() => addToStandby(tech.id)}
                          disabled={data.standby.includes(tech.id)}
                        >
                          + Standby
                        </button>

                        <button
                          className="btn-light btn-small"
                          onClick={() => beginEditName(tech)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-danger btn-small"
                          onClick={() => deleteTechnician(tech.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="hint">
            CALL records the call and updates Turn Position. It does not
            change the Standby order.
          </p>
        </section>

        {/* 2. STANDBY */}
        <section className="card">
          <div className="card-head">
            <h2>2. Standby</h2>

            <div className="btn-row">
              <span className="count">
                {data.standby.length} waiting
              </span>
              <button
                className="btn-light btn-small"
                onClick={() =>
                  setData((previous) => ({
                    ...previous,
                    standbyVisible: !previous.standbyVisible,
                  }))
                }
              >
                {data.standbyVisible ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {data.standbyVisible && (
            <>
              {data.standby.length === 0 ? (
                <div className="empty">
                  Standby is empty. Add technicians from the Technicians
                  list.
                </div>
              ) : (
                <div className="list">
                  {activeStandbyTechnicians.map((tech, index) => (
                    <div className="item" key={tech.id}>
                      <div className="position-number">
                        {index + 1}
                      </div>

                      <span className="item-name">{tech.name}</span>

                      <div className="btn-row">
                        <button
                          className="btn-light btn-small"
                          disabled={index === 0}
                          onClick={() => moveStandby(index, -1)}
                          aria-label={`Move ${tech.name} up in Standby`}
                        >
                          ↑
                        </button>

                        <button
                          className="btn-light btn-small"
                          disabled={index === data.standby.length - 1}
                          onClick={() => moveStandby(index, 1)}
                          aria-label={`Move ${tech.name} down in Standby`}
                        >
                          ↓
                        </button>

                        <button
                          className="btn-call"
                          onClick={() => callTechnician(tech.id)}
                        >
                          CALL
                        </button>

                        <button
                          className="btn-light btn-small"
                          onClick={() => removeFromStandby(tech.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {availableForStandby.length > 0 && (
                <div className="available-section">
                  <p className="hint">
                    Add a technician to the end of Standby:
                  </p>

                  <div className="btn-row">
                    {availableForStandby.map((tech) => (
                      <button
                        key={tech.id}
                        className="btn-light btn-small"
                        onClick={() => addToStandby(tech.id)}
                      >
                        + {tech.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <p className="hint">
            Calling a technician here will not remove them from Standby
            or change their position in this list.
          </p>
        </section>

        {/* 3. TURN POSITION */}
        <section className="card turn-card">
          <div className="card-head">
            <div>
              <h2>3. Turn Position</h2>
              <p className="hint">
                Called technicians appear here in live turn order.
              </p>
            </div>

            <div className="btn-row">
              <span className="count">
                {data.turnPosition.length} in queue
              </span>

              <button
                className={editingOrder ? "btn-primary" : "btn-light"}
                onClick={() => setEditingOrder((value) => !value)}
              >
                {editingOrder ? "Done Editing" : "Edit Order"}
              </button>
            </div>
          </div>

          <div className="star-legend">
            <span className="star-symbol">*</span>
            <span>
              Priority marker. The star is displayed only in Turn Position.
            </span>
          </div>

          {data.turnPosition.length === 0 ? (
            <div className="empty turn-empty">
              Turn Position is empty at the start of the day.
              <br />
              Press CALL in Technicians or Standby to add a technician.
            </div>
          ) : (
            <div className="list">
              {activeTurnTechnicians.map((tech, index) => {
                const isStarred = data.starredIds.includes(tech.id);

                return (
                  <div className="item turn-item" key={tech.id}>
                    <div className="position-number">
                      {index + 1}
                    </div>

                    <span className="item-name">
                      {tech.name}
                      {isStarred && (
                        <span className="star-symbol"> *</span>
                      )}
                    </span>

                    <div className="btn-row">
                      <button
                        className={
                          isStarred
                            ? "btn-star active-star btn-small"
                            : "btn-light btn-small"
                        }
                        onClick={() => toggleStar(tech.id)}
                        title={
                          isStarred
                            ? "Remove priority star"
                            : "Mark as priority"
                        }
                      >
                        {isStarred ? "★ Priority" : "☆ Mark *"}
                      </button>

                      {editingOrder && (
                        <>
                          <button
                            className="btn-light btn-small"
                            disabled={index === 0}
                            onClick={() =>
                              moveTurnPosition(index, -1)
                            }
                            aria-label={`Move ${tech.name} up`}
                          >
                            ↑ Up
                          </button>

                          <button
                            className="btn-light btn-small"
                            disabled={
                              index === data.turnPosition.length - 1
                            }
                            onClick={() =>
                              moveTurnPosition(index, 1)
                            }
                            aria-label={`Move ${tech.name} down`}
                          >
                            ↓ Down
                          </button>
                        </>
                      )}

                      <button
                        className="btn-call"
                        onClick={() => callTechnician(tech.id)}
                      >
                        CALL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="hint">
            Press Edit Order to manually move technicians up or down.
            Marking a technician with * does not automatically change
            the queue order.
          </p>
        </section>

        {/* 4. TURN HISTORY */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2>4. Turn History</h2>
              <p className="hint">
                Each CALL creates a separate history record.
              </p>
            </div>

            <div className="btn-row">
              <span className="count">
                {data.history.length} calls
              </span>

              <button
                className="btn-light"
                disabled={data.history.length === 0}
                onClick={undoLastCall}
              >
                UNDO
              </button>
            </div>
          </div>

          {data.history.length === 0 ? (
            <div className="empty">No calls recorded today.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Turn</th>
                    <th>Technician</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {[...data.history].reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.turnNo}</td>
                      <td>{entry.techName}</td>
                      <td>{formatDate(entry.timestamp)}</td>
                      <td>{formatTime(entry.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* 5. NEW DAY */}
      <section className="card new-day-card">
        <div className="card-head">
          <div>
            <h2>5. New Day</h2>
            <p className="hint">
              Archives today's history, then clears today's active
              queue and Standby list.
            </p>
          </div>

          <button
            className="btn-danger"
            onClick={() => setConfirmNewDay(true)}
          >
            NEW DAY
          </button>
        </div>

        {confirmNewDay && (
          <div className="warning">
            <p>
              Start a new day? The current history will be archived
              before today's lists are cleared.
            </p>

            <div className="btn-row">
              <button
                className="btn-danger"
                onClick={startNewDay}
              >
                Confirm New Day
              </button>

              <button
                className="btn-light"
                onClick={() => setConfirmNewDay(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 6. ARCHIVE */}
      <section className="card archive-card">
        <div className="card-head">
          <h2>6. Archive</h2>
          <span className="count">
            {availableArchiveDays.length} archived days
          </span>
        </div>

        {availableArchiveDays.length === 0 ? (
          <div className="empty">
            No archived days yet. Use NEW DAY to archive the current
            history.
          </div>
        ) : (
          availableArchiveDays.map((day) => (
            <details className="archive-day" key={day.id}>
              <summary>
                <strong>{day.date}</strong>
                <span className="count">
                  {day.history.length} calls
                </span>
              </summary>

              {day.history.length === 0 ? (
                <p className="hint">No calls recorded.</p>
              ) : (
                <div className="table-wrap archive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Turn</th>
                        <th>Technician</th>
                        <th>Date</th>
                        <th>Time</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[...day.history].reverse().map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.turnNo}</td>
                          <td>{entry.techName}</td>
                          <td>{formatDate(entry.timestamp)}</td>
                          <td>{formatTime(entry.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))
        )}
      </section>

      <footer className="footer">
        Data is saved in this browser on this device.
      </footer>
    </div>
  );
}