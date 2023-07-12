"use strict";

const form = document.querySelector(".form");
const workoutCont = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const sorter = document.querySelector(".option-sort");
const deleteAll = document.querySelector(".option-deleteall");
const workoutsContainer = document.querySelector(".workouts__container");
const sidebar = document.querySelector(".sidebar");
const error = document.querySelector(".error");
const logo = document.querySelector(".logo");

///////////////////////////////////////////////////
// Workout Architecture

class Workout {
  date = new Date();
  id = Date.now() + "".slice(-10);
  // clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    //console.log(this.id);
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  // click() {
  //   this.clicks++;
  // }
}

class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace(); // calling
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance; // making
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed(); // calling
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60); // making
    return this.speed;
  }
}

//const run1 = new Running([39, -12], 5.2, 25, 140);
//const cycle1 = new Cycling([39, -12], 27, 95, 540);

let map, mapEvent, sortCondition, markerGroup, curWork, curElement;

//////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markerGroup = [];
  #curWork;
  #curElement;

  // We call it when the page loads:
  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach handler
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);

    workoutCont.addEventListener("click", this._moveToPopup.bind(this));
    sorter.addEventListener("click", this._sorter.bind(this));
    deleteAll.addEventListener("click", this._deleteAll.bind(this));
    logo.addEventListener("click", this._hideForm);

    window.addEventListener("load", this._setDeleteButtons.bind(this));
    window.addEventListener("load", this._setEditButtons.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        alert("Could not get your position");
      });
  }

  _loadMap(position) {
    //console.log(position);
    //console.log(this);

    //const latitude = position.coords.latitude;
    //const longitude = position.coords.longitude;
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    //console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    //console.log(this);
    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);
    //console.log(map);

    let userLocation = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.fr/hot/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(this.#map);
    L.marker(coords)
      .addTo(this.#map)
      .bindPopup("Your current location")
      .openPopup();
    // Handling click on map
    this.#map.on("click", this._showForm.bind(this));

    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
    form.style.display = "grid";

    if (inputType === "Running") {
      inputCadence.closest(".form__row").classList.remove("form__row--hidden");
      inputElevation.closest(".form__row").classList.add("form__row--hidden");
    } else if (inputType === "Cycling") {
      inputCadence.closest(".form__row").classList.remove("form__row--hidden");
      inputElevation.closest(".form__row").classList.add("form__row--hidden");
    }

    this.editBtns.forEach((btn) => {
      btn.style.display = "none";
    });
  }

  _hideForm() {
    // Clear Input Fields
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);

    this.editBtns.forEach((btn) => {
      btn.style.display = "block";
    });
  }

  _toggleElevationField() {
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");

    // the closest choose the parents and not siblings
  }

  _newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value; // the + is for converting it to a number
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if workout running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._showError();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if workout cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value; // the + is for converting it to a number

      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._showError();

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);
    //console.log(workout);

    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    // hide form
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    //console.log(this.#workouts);
    //console.log(JSON.stringify(this.#workouts));

    this._setDeleteButtons();
    this._setEditButtons();
  }

  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♂️"} ${workout.description}`
      )
      .openPopup();
    this.#markerGroup.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <div class="workout__btns">
      <div class="workout__btns-btn">
       <i class="fa fa-pencil workout__btn-edit" style="font-size:20px"></i>
      </div>
       <div class="workout__btns-btn">
        <i class="fa fa-trash-o workout__btn-delete" style="font-size: 20px"></i><br />
       </div>
      </div>
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === "running" ? "🏃‍♂️" : "🚴‍♂️"
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>  
               `;

    if (workout.type === "running")
      html += `
       <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
       </div>
       <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
        </div>
       </li>
       `;

    if (workout.type === "cycling")
      html += `
      <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.speed.toFixed(1)}</span>
      <span class="workout__unit">km/h</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⛰</span>
      <span class="workout__value">${workout.elevationGain}</span>
      <span class="workout__unit">m</span>
    </div>
   </li>
      `;

    workoutsContainer.insertAdjacentHTML("afterbegin", html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    //console.log(workoutEl); // the element
    //console.log(workout); // the object

    if (!workout) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.#workouts)); // stringify to convert to string
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts")); // parse to convert to object
    //console.log(data);

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach((work) => {
      this._renderWorkout(work);
    });

    // The data coming from local storage will not inherit the class prototype, and this is not how to fix it
    //data.forEach((localObject) => {
    //if ((localObject.type = "running")) localObject = Object.create(Running);
    //else localObject = Object.create(Cycling);
    //});
  }

  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }

  _sorter() {
    // sort the workouts array
    if (sortCondition) {
      this.#workouts.sort((a, b) => a.type > b.type);
      sortCondition = !sortCondition;
    } else {
      this.#workouts.sort((a, b) => a.type < b.type);
      sortCondition = !sortCondition;
    }

    // remove the workouts html
    workoutsContainer.innerHTML = "";

    // re-render the workouts
    this.#workouts.forEach((work) => {
      this._renderWorkout(work);
    });
  }

  _deleteAll() {
    this.#markerGroup.forEach((marker) => {
      this.#map.removeLayer(marker);
    });

    this.#workouts = [];
    localStorage.clear();
    this.#markerGroup = [];
    workoutsContainer.innerHTML = "";
  }

  //////////////////////////////////////////// Delete button
  _setDeleteButtons() {
    // 1) Set delete btns
    this.deleteBtns = document.querySelectorAll(".workout__btn-delete");

    if (!this.deleteBtns) return;
    else
      this.deleteBtns.forEach((btn) => {
        btn.addEventListener("click", this._setDeleteElements.bind(this));
      });
  }

  _setDeleteElements(e) {
    // 2) Get and save workout element
    this.#curElement = e.target.closest(".workout");

    // 3) Get and save workout object
    this.#workouts.forEach((work) => {
      if (work.id === this.#curElement.dataset.id) {
        this.#curWork = work;
      }
    });
    this._delete();
  }

  _delete() {
    // 4) Delete workout
    this.#curElement.remove(); // remove workout element

    this.#workouts = this.#workouts.filter(
      (workout) => workout.id !== this.#curWork.id
    );

    // 5) Re-set the local storage
    localStorage.clear();
    this._setLocalStorage();

    // 5) Re-set workouts markers
    this._resetMarkers();
  }

  ///////////////////////////////////////////////// Edit buttons
  _setEditButtons() {
    // 1) Set edit btns
    this.editBtns = document.querySelectorAll(".workout__btn-edit");

    if (!this.editBtns) return;
    else
      this.editBtns.forEach((btn) => {
        btn.addEventListener("click", this._setEditElements.bind(this));
      });
  }

  _setEditElements(e) {
    // 2) Get and save workout element
    this.#curElement = e.target.closest(".workout");

    // 3) Get and save workout object
    this.#workouts.forEach((work) => {
      if (work.id === this.#curElement.dataset.id) {
        this.#curWork = work;
      }
    });
    this._edit();
  }

  _edit() {
    // 4) change the workouts list
    this._showForm();
    // remove workout element:
    this.#curElement.remove();
    // remove workout object:
    this.#workouts = this.#workouts.filter(
      (workout) => workout.id !== this.#curWork.id
    );
    // 5) Re-set workouts markers
    this._resetMarkers();

    this.#mapEvent = {
      latlng: {
        lat: this.#curWork.coords[0],
        lng: this.#curWork.coords[1],
      },
    };

    // 6) Fill the form with the current workout to edit
    inputType.value = this.#curWork.type;
    inputDistance.value = this.#curWork.distance;
    inputDuration.value = this.#curWork.duration;

    if (inputElevation.value > 0) {
      inputElevation.value = this.#curWork.elevation;
    } else inputElevation.value = "";

    if (inputCadence.value > 0) {
      inputCadence.value = this.#curWork.cadence;
    } else inputCadence.value = "";

    /*
    this.editBtn = document.querySelectorAll(".workout__btn-edit");

    if (!this.editBtn) return;

    // 1) Get and save current element
    this.editBtn.forEach((btn) => {
      btn.addEventListener("click", () => {
        this._showForm();
        let curElement = btn.closest(".workout");

        // 2) Get and save current workout object by element's id
        this.#workouts.forEach((work) => {
          if (work.id === curElement.dataset.id) {
            let curWork = work;

            // 3) Fill the form with the current workout to edit
            inputType.value = curWork.type;
            inputDistance.value = curWork.distance;
            inputDuration.value = curWork.duration;

            if (inputCadence.value > 0) {
              inputCadence.value = curWork.cadence;
            } else inputCadence.value = "";

            if (inputElevation.value > 0) {
              inputElevation.value = curWork.elevation;
            } else inputElevation.value = "";

            // 4) Set the current clicked coords on map to the edited workout
            this.#mapEvent = {
              latlng: { lat: curWork.coords[0], lng: curWork.coords[1] },
            };

            // 5) Check object index
            this.#workIndex = this.#workouts.findIndex(
              (work) => work.id == curWork.id
            );

            // 6) Delete object from the array
            this.#workouts.splice(this.#workIndex);
            curElement.remove(); // delete the element HTML

            // 7) Set the marker for the edited workout
            this._renderWorkoutMarker(curWork);

            // 8) Reset all markers
            this.#markerGroup.forEach((marker) => {
              this.#map.removeLayer(marker);
            });

            this.#workouts.forEach((work) => {
              this._renderWorkoutMarker(work);
            });
          }
        });
      });
    });
    */
  }

  _showError() {
    error.classList.remove("hidden");

    setTimeout(() => error.classList.add("hidden"), 3500);
  }

  _resetMarkers() {
    this.#markerGroup.forEach((marker) => {
      this.#map.removeLayer(marker);
    });

    this.#workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
  }
}

const app = new App();
