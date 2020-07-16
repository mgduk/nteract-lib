import React, { useState, useEffect, useRef } from 'react';

function EditableName({ name, logOut, changeName }) {
  const [editedName, setEditedName] = useState(null);
  const [updating, setUpdating] = useState(false);

  const updateNameInput = useRef();

  const startUpdatingName = () => {
    setEditedName(name);
    setUpdating(true);
  };
  const stopUpdatingName = () => {
    setUpdating(false);
  };

  const updateNameChange = ev => {
    setEditedName(ev.target.value);
  };

  const updateNameKeyDown = ev => {
    switch (ev.key) {
      case 'Escape':
        setEditedName(name);
        stopUpdatingName();
        break;
      case 'Enter':
        changeName(ev.target.value);
        stopUpdatingName();
        break;
      default:
    }
  };

  const updateNameBlur = ev => {
    changeName(ev.target.value);
    stopUpdatingName();
  };

  useEffect(() => {
    if (updating) {
      updateNameInput.current.focus();
    }
  });

  return (
    <div className="EditableName">
      <span>Hi </span>
      { updating
        ? <input ref={updateNameInput} onKeyDown={updateNameKeyDown} onBlur={updateNameBlur} onChange={updateNameChange} value={editedName} />
        : <span title="Click to change your name" className="editable" onClick={startUpdatingName}>{name}</span>
      }
      . <span className="link logout" onClick={logOut}>Log out</span>
    </div>
  );
}

export default EditableName;
