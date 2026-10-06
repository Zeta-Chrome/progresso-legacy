let currentTheme = "light";
let skills = [];
let hoursWorkedDict = {};
let exerciseHoursDict = {};
let currentDate = new Date();
let selectedDate = null;
let openPanelStack = [];

const Pages = ["progressPage", "calendarPage", "chartPage"];

document.addEventListener("DOMContentLoaded", () => {
	loadData();
});

function loadData() {
	window.electronAPI.loadData("ProgressoData").then((savedData) => {
		if (savedData) {
			console.log("Loaded data:", savedData);
			currentTheme = savedData.currentTheme || "light";

			// Clean the skills data to remove any null/undefined values
			skills = cleanSkillsData(savedData.skills || []);

			hoursWorkedDict = savedData.hoursWorkedDict || {};
			exerciseHoursDict = savedData.exerciseHoursDict || {};
			selectedDate = savedData.selectedDate ? new Date(savedData.selectedDate) : new Date();
		} else {
			console.log("No saved data found.");
			selectedDate = new Date();
		}

		currentDate = new Date();
		rolloverPlannedTasks();
		saveData();
		startMidnightRollover();
		setCurrentTheme();
		setupEventListeners();
		showProgressPage();
	}).catch(error => {
		console.error("Error loading data:", error);
		currentDate = new Date();
		selectedDate = new Date();
		setCurrentTheme();
		setupEventListeners();
		showProgressPage();
	});
}

function rolloverPlannedTasks() {
	const todayStr = formatDate(new Date());

	function processSkill(skill) {
		skill.tasks.forEach(task => {
			if (task.planned && !task.completed && task.plannedDate && task.plannedDate < todayStr) {
				task.plannedDate = todayStr;
			}
		});
		if (skill.skills && skill.skills.length > 0) {
			skill.skills.forEach(subskill => processSkill(subskill));
		}
	}

	skills.forEach(skill => processSkill(skill));
}

function startMidnightRollover() {
	const now = new Date();
	const msUntilMidnight = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() + 1,
		0, 0, 0, 0
	) - now;

	setTimeout(() => {
		rolloverPlannedTasks();
		saveData();
		renderCalendar();
		renderSkills();

		startMidnightRollover();
	}, msUntilMidnight);
}

function cleanSkillsData(skillsList) {
	return skillsList
		.filter(skill => skill !== null && skill !== undefined)
		.filter(skill => skill.name !== "" || !skill.isEditing)
		.map(skill => ({
			...skill,
			tasks: (skill.tasks || []).filter(task => task !== null && task !== undefined).map(task => ({
				...task,
				planned: task.planned !== undefined ? task.planned : false,
				plannedDate: task.plannedDate || null
			})),
			skills: cleanSkillsData(skill.skills || [])
		}));
}

function setCurrentTheme() {
	document.body.classList.toggle("dark-mode", currentTheme === "dark");
	document.getElementById("themeToggle").textContent =
		currentTheme === "light" ? "🌙" : "☀️";
}

function setupEventListeners() {
	document.getElementById("themeToggle").addEventListener("click", toggleTheme);
	document
		.getElementById("progressButton")
		.addEventListener("click", showProgressPage);
	document
		.getElementById("calendarButton")
		.addEventListener("click", showCalendarPage);
	document
		.getElementById("chartButton")
		.addEventListener("click", showChartPage);
	document
		.getElementById("addSkillButton")
		.addEventListener("click", () => addSkill());
	document
		.getElementById("setCurrentDate")
		.addEventListener("click", () => setCurrentDate());
	const exerciseHours = document
		.getElementById("exerciseHours")
		.querySelector(".hours-input");
	exerciseHours.addEventListener("change", (e) => {
		updateExerciseHours(exerciseHours, e.target.value);
	});
	setupMainSkillDragAndDrop();
}

function toggleTheme() {
	currentTheme = currentTheme === "light" ? "dark" : "light";
	document.body.classList.toggle("dark-mode");
	document.getElementById("themeToggle").textContent =
		currentTheme === "light" ? "🌙" : "☀️";
	renderCalendar();
	renderChart();
	saveData();
}

function showPage(page) {
	Pages.forEach((pageId) => {
		document.getElementById(pageId).style.display = "none";
	});
	document.getElementById(page).style.display = "block";
}

function showProgressPage() {
	showPage("progressPage");
	renderSkills();
}

function showCalendarPage() {
	showPage("calendarPage");
	renderCalendar();
}

function showChartPage() {
	showPage("chartPage");
	renderChart();
}

function setupMainSkillDragAndDrop() {
	const skillsGrid = document.getElementById("skillsList");

	skillsGrid.addEventListener("mousedown", (e) => {
		if (e.button === 2) {
			e.preventDefault();

			const skillElement = e.target.closest(".skill");
			if (skillElement) {
				setupDragAndDrop(skillElement, skillsGrid, null, "skill");
			}
		}
	});
}

function setCurrentDate() {
	const setCurrentDateButton = document.getElementById("setCurrentDate");

	if (setCurrentDateButton.classList.contains("button-set")) {
		setCurrentDateButton.classList.remove("button-set");
		setCurrentDateButton.innerText = "Set";
		currentDate = new Date();
	} else {
		setCurrentDateButton.classList.add("button-set");
		setCurrentDateButton.innerText = "Unset";
		currentDate = selectedDate;
	}

	renderCalendar();
	saveData();
}

function addSkill(detailsContainer = null, parentId = null) {
	const newSkill = {
		id: Date.now(),
		name: "",
		skills: [],
		tasks: [],
		hours: 0,
		isEditing: true,
	};

	if (!detailsContainer)
		detailsContainer = document.getElementById("skillsList");

	renderSkill(newSkill, detailsContainer);

	if (parentId) {
		const skill = findSkillById(parentId);
		skill.skills.push(newSkill);
	} else {
		skills.push(newSkill);
	}

	updateOverallProgress();
}

function findSkillById(id, skillList = skills) {
	for (const skill of skillList) {
		if (skill.id === id) return skill;
		const subskill = findSkillById(id, skill.skills);
		if (subskill) return subskill;
	}
	return null;
}

function renderSkills(container = null, skillList = skills) {
	if (!container) container = document.getElementById("skillsList");
	container.innerHTML = "";
	const sortedSkills = [...skillList].sort((a, b) => {
		return calculateProgress(b) - calculateProgress(a);
	});
	sortedSkills.forEach((skill) => renderSkill(skill, container));

	updateOverallProgress();
}

function renderSkill(skill, container) {
	const skillElement = createSkillElement(skill);
	container.appendChild(skillElement);
}

function createSkillElement(skill) {
	const skillElement = document.createElement("div");
	skillElement.className = "skill";
	skillElement.id = `skill-${skill.id}`;

	const skillHeader = createSkillHeader(skill);

	skillElement.appendChild(skillHeader);

	const progressBarContainer = document.createElement("div");
	progressBarContainer.className = "progress-bar";

	const progressBar = document.createElement("div");
	progressBar.className = "progress";
	progressBar.style.width = `${calculateProgress(skill)}%`;

	progressBarContainer.appendChild(progressBar);
	skillElement.appendChild(progressBarContainer);

	const toggleDetailsButton = document.createElement("button");
	toggleDetailsButton.className = "toggle-details";
	toggleDetailsButton.textContent = "▼";
	toggleDetailsButton.addEventListener("click", () => openSkillDetails(skill));
	skillElement.appendChild(toggleDetailsButton);
	return skillElement;
}

function createSkillHeader(skill) {
	const skillHeader = document.createElement("div");
	skillHeader.className = "skill-header";

	const nameElement = skill.isEditing
		? `<input type="text" class="skill-name-input" value="${skill.name}">`
		: `<h3 class="skill-name">${skill.name}</h3>`;
	skillHeader.innerHTML = `
    <button class="edit-skill">✎</button>
    <div class="skill-name-container">
      ${nameElement}
    </div>
    <button class="delete-skill">🗑</button>
  `;

	addSkillHeaderEventListeners(skillHeader, skill);

	return skillHeader;
}

function addSkillHeaderEventListeners(skillHeader, skill) {
	const editButton = skillHeader.querySelector(".edit-skill");
	const deleteButton = skillHeader.querySelector(".delete-skill");

	deleteButton.addEventListener("click", () => deleteSkill(skill));
	editButton.addEventListener("click", () => toggleSkillEditing(skill));

	if (skill.isEditing) {
		const input = skillHeader.querySelector(".skill-name-input");
		input.addEventListener("blur", () => finishEditing(skill, input));
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter") input.blur();
		});
		setTimeout(() => {
			input.focus();
			input.setSelectionRange(input.value.length, input.value.length);
		}, 0);
	}
}

function openSkillDetails(skill, push = true) {
	const leftPanel = document.getElementById("leftPanel");
	const progressPageContent = document.getElementById("progressPageContent");
	leftPanel.innerHTML = `
    <button class="back-button">⬅️ Back</button>
    <h3 class="open-skill-name">${skill.name}(0/0)</h3>
    <div class="progress-bar">
      <div class="progress" style="width: ${calculateProgress(skill)}%"></div>
    </div>
    <div class="hours-container">
      <input type="number" value="${skill.hours}" min="0" step="0.5" class="hours-input">
      <span class="hours-label">hours</span>
      <button class="add-skill">+ Skill</button>
      <button class="add-task">+ Task</button>
    </div>
    <div class="skill-details">
      <div class="tasks"></div>
      <div class="skills"></div>
    </div>
  `;

	updatePanelProgress(skill);

	leftPanel
		.querySelector(".back-button")
		.addEventListener("click", () => closeLeftPanel());
	addDetailsContainerEventListeners(leftPanel, skill);

	renderTasks(leftPanel.querySelector(".tasks"), skill);
	renderSkills(leftPanel.querySelector(".skills"), skill.skills);

	leftPanel.classList.add("active");
	progressPageContent.classList.add("with-panel");
	if (push) openPanelStack.push(skill);
}

function closeLeftPanel(closeall = false) {
	const skill = openPanelStack.pop();
	const parentSkill = findParentSkill(skill.id);
	if (
		openPanelStack.length > 0 &&
		openPanelStack[openPanelStack.length - 1] !== parentSkill
	) {
		openPanelStack.length = 0;
	}
	if (openPanelStack.length === 0 || closeall) {
		const leftPanel = document.getElementById("leftPanel");
		const progressPageContent = document.getElementById("progressPageContent");
		leftPanel.classList.remove("active");
		progressPageContent.classList.remove("with-panel");
	} else {
		openSkillDetails(openPanelStack[openPanelStack.length - 1], false);
	}
}

function addDetailsContainerEventListeners(detailsContainer, skill) {
	const hoursInput = detailsContainer.querySelector(".hours-input");
	const addSkillButton = detailsContainer.querySelector(".add-skill");
	const addTaskButton = detailsContainer.querySelector(".add-task");
	const skillsContainer = detailsContainer.querySelector(".skills");
	const tasksContainer = detailsContainer.querySelector(".tasks");

	hoursInput.addEventListener("change", (e) =>
		updateSkillHours(skill, e.target.value),
	);
	addSkillButton.addEventListener("click", (e) => {
		e.stopPropagation();
		addSkill(skillsContainer, skill.id);
	});
	addTaskButton.addEventListener("click", (e) => {
		e.stopPropagation();
		addTask(detailsContainer, skill);
	});
	skillsContainer.addEventListener("mousedown", (e) => {
		if (e.button === 2) {
			e.preventDefault();
			const skillElement = e.target.closest(".skill");
			const skillsContainer = detailsContainer.querySelector(".skills");
			if (skillElement) {
				setupDragAndDrop(skillElement, skillsContainer, skill, "skill");
			}
		}
	});
	tasksContainer.addEventListener("mousedown", (e) => {
		if (e.button === 2) {
			e.preventDefault();
			const taskElement = e.target.closest(".task");
			const tasksContainer = detailsContainer.querySelector(".tasks");
			if (taskElement) {
				setupDragAndDrop(
					taskElement,
					tasksContainer,
					findSkillById(skill.id),
					"task",
				);
			}
		}
	});
}

function toggleSkillEditing(skill) {
	skill.isEditing = !skill.isEditing;
	const skillElement = document.getElementById(`skill-${skill.id}`);
	const newSkillElement = createSkillElement(skill);
	skillElement.parentNode.replaceChild(newSkillElement, skillElement);
	saveData();
}

function finishEditing(skill, input) {
	skill.name = input.value.trim() || "New Skill";
	skill.isEditing = false;
	const skillElement = document.getElementById(`skill-${skill.id}`);

	const inputElement = skillElement.querySelector(".skill-name-input");

	if (inputElement) {
		const newHeading = document.createElement("h3");
		newHeading.className = "skill-name";
		newHeading.textContent = skill.name;
		inputElement.parentNode.replaceChild(newHeading, inputElement);
	}
	saveData();
}

function updateSkillHours(skill, newValue) {
	const newHours = parseFloat(newValue) || 0;
	const hoursDiff = newHours - skill.hours;
	const formattedDate = formatDate(currentDate);

	hoursWorkedDict[formattedDate] =
		(hoursWorkedDict[formattedDate] || 0) + hoursDiff;
	skill.hours = newHours;
	renderCalendar();
	saveData();
}

function updateExerciseHours(exerciseHours, newValue) {
	const newHours = parseFloat(newValue) || 0;
	const formattedDate = formatDate(currentDate);
	if (formatDate(selectedDate) == formattedDate) {
		exerciseHoursDict[formattedDate] = newHours;
		renderCalendar();
		saveData();
	} else exerciseHours.value = exerciseHoursDict[formatDate(selectedDate)] || 0;
}

function deleteSkill(skill) {
	let id = skill.id;
	updatePanelProgress(skill);
	const skillToDelete = findSkillById(id);
	if (!skillToDelete) return;

	const parentSkill = findParentSkill(id);
	if (parentSkill) {
		parentSkill.skills = parentSkill.skills.filter((s) => s.id !== id);
		updateSkillProgress(parentSkill);
		updatePanelProgress(parentSkill);
	} else {
		if (openPanelStack.length > 0) closeLeftPanel(true);
		skills = skills.filter((s) => s.id !== id);
	}

	const skillElement = document.getElementById(`skill-${id}`);
	if (skillElement) skillElement.remove();

	updateOverallProgress();
	saveData();
}

function findParentSkill(childId, skillList = skills) {
	for (const skill of skillList) {
		if (skill.skills && skill.skills.some((s) => s.id === childId))
			return skill;
		const found = findParentSkill(childId, skill.skills);
		if (found) return found;
	}
	return null;
}

function addTask(detailsContainer, skill) {
	const taskId = Date.now();
	const taskElement = document.createElement("div");
	taskElement.className = "task";
	taskElement.dataset.taskId = taskId;
	taskElement.innerHTML = `<input type="text" class="task-name-input" placeholder="Task name">
    <button class="delete-task">🗑️</button>`;

	const tasksContainer = detailsContainer.querySelector(".tasks");
	tasksContainer.appendChild(taskElement);

	const input = taskElement.querySelector(".task-name-input");
	input.focus();

	let taskAdded = false;

	input.addEventListener("keypress", (e) => {
		if (e.key === "Enter") {
			const taskName = input.value.trim();
			if (taskName) {
				skill.tasks.push({
					id: taskId,
					name: taskName,
					completed: false,
					planned: false,
					plannedDate: null
				});
				taskAdded = true;
				skill.tasks = sortTasks(skill.tasks);
				renderTasks(tasksContainer, skill);
				updatePanelProgress(skill);
				updateSkillProgress(skill);
				updateOverallProgress();
				taskElement.remove();
				saveData();
			}
		}
	});

	taskElement.querySelector(".delete-task").addEventListener("click", () => {
		if (taskAdded) {
			skill.tasks = skill.tasks.filter(t => t.id !== taskId);
		}
		taskElement.remove();
	});

	input.addEventListener("blur", () => {
		if (!taskAdded) {
			setTimeout(() => {
				if (!taskAdded && taskElement.parentNode) {
					taskElement.remove();
				}
			}, 200);
		}
	});
}

function sortTasks(tasks) {
	return tasks.sort((a, b) => {
		if (a.completed === b.completed) {
			return tasks.indexOf(a) - tasks.indexOf(b);
		}
		return a.completed ? 1 : -1;
	});
}

function toggleTaskPlanned(task) {
	task.planned = !task.planned;
	if (task.planned) {
		task.plannedDate = formatDate(currentDate);
	} else {
		task.plannedDate = null;
	}
	saveData();
	renderCalendar();
}

function renderTasks(tasksElement, skill) {
	tasksElement.innerHTML = "";

	const validTasks = skill.tasks.filter(task => task !== null && task !== undefined);
	const sortedTasks = sortTasks(validTasks);

	sortedTasks.forEach((task) => {
		const taskElement = document.createElement("div");
		taskElement.className = "task";
		taskElement.dataset.taskId = task.id;

		// Create checkbox container with badge
		const checkboxContainer = document.createElement("div");
		checkboxContainer.className = "checkbox-container";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = task.completed;

		// Only show badge if task is not completed
		if (!task.completed) {
			const badge = document.createElement("span");
			badge.className = "checkbox-badge";
			badge.textContent = task.planned ? "P" : "U";
			badge.classList.add(task.planned ? "planned" : "unplanned");
			checkboxContainer.appendChild(badge);
		}

		checkboxContainer.appendChild(checkbox);

		const taskName = document.createElement("span");
		taskName.textContent = task.name;

		const deleteBtn = document.createElement("button");
		deleteBtn.className = "delete-task";
		deleteBtn.textContent = "🗑️";

		taskElement.appendChild(checkboxContainer);
		taskElement.appendChild(taskName);
		taskElement.appendChild(deleteBtn);

		checkbox.addEventListener("change", (e) => {
			const wasCompleted = task.completed;
			task.completed = e.target.checked;
			task.date = new Date();

			if (wasCompleted && !task.completed) {
				skill.tasks = skill.tasks.filter((t) => t.id !== task.id);
				skill.tasks.unshift(task);
			} else if (!wasCompleted && task.completed) {
				skill.tasks = skill.tasks.filter((t) => t.id !== task.id);
				skill.tasks.push(task);
			}

			updatePanelProgress(skill);
			updateSkillProgress(skill);
			updateOverallProgress();
			renderTasks(tasksElement, skill);
			renderCalendar();
			saveData();
		});

		// Middle-click to toggle planned status (only if task is not completed)
		taskElement.addEventListener("mousedown", (e) => {
			if (e.button === 1) { // Middle mouse button
				e.preventDefault();
				if (!task.completed) {
					toggleTaskPlanned(task);
					renderTasks(tasksElement, skill);
				}
			}
		});

		taskName.addEventListener("dblclick", () => {
			const input = document.createElement("input");
			input.type = "text";
			input.className = "task-name-input";
			input.value = task.name;
			taskName.replaceWith(input);
			input.focus();

			const saveName = () => {
				const newName = input.value.trim();
				if (newName) {
					task.name = newName;
					saveData();
				}
				renderTasks(tasksElement, skill);
			};

			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
					saveName();
				}
			});

			input.addEventListener("blur", saveName);
		});

		deleteBtn.addEventListener("click", () => {
			skill.tasks = skill.tasks.filter((t) => t.id !== task.id);
			renderTasks(tasksElement, skill);
			updatePanelProgress(skill);
			updateSkillProgress(skill);
			updateOverallProgress();
			renderCalendar();
			saveData();
		});

		tasksElement.appendChild(taskElement);
	});
}

function calculateTotalTasks(skill) {
	if (skill.skills.length > 0)
		return (
			skill.tasks.length +
			skill.skills.reduce(
				(sum, subskill) => sum + calculateTotalTasks(subskill),
				0,
			)
		);
	else return skill.tasks.length;
}

function calculateCompletedTasks(skill) {
	if (skill.skills.length > 0)
		return (
			skill.tasks.filter((task) => task.completed).length +
			skill.skills.reduce(
				(sum, subskill) => sum + calculateCompletedTasks(subskill),
				0,
			)
		);
	else return skill.tasks.filter((task) => task.completed).length;
}

function calculateProgress(skill) {
	const totalTasks = calculateTotalTasks(skill);
	const completedTasks = calculateCompletedTasks(skill);
	return totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
}

function updatePanelProgress(skill) {
	const totalTasks = calculateTotalTasks(skill);
	const completedTasks = calculateCompletedTasks(skill);
	const progress = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
	const leftPanel = document.getElementById(`leftPanel`);

	if (leftPanel) {
		const skillName = leftPanel.querySelector(".open-skill-name");
		if (skillName) {
			skillName.textContent = skillName.textContent.replace(/\d+\/\d+/g, `${completedTasks}/${totalTasks}`);
		}

		const progressBar = leftPanel.querySelector(".progress-bar .progress");
		if (progressBar) {
			progressBar.style.width = `${progress}%`;
		}
	}
}

function updateSkillProgress(skill) {
	const progress = calculateProgress(skill);
	const skillElement = document.getElementById(`skill-${skill.id}`);

	if (skillElement) {
		const progressBar = skillElement.querySelector(".progress-bar .progress");
		if (progressBar) {
			progressBar.style.width = `${progress}%`;
		}
	}

	if (progress === 100) {
		const parentSkill = findParentSkill(skill.id);

		if (parentSkill) {
			const index = parentSkill.skills.findIndex((s) => s.id === skill.id);
			if (index !== -1) {
				parentSkill.skills.push(parentSkill.skills.splice(index, 1)[0]);
			}
		} else {
			const index = skills.findIndex((s) => s.id === skill.id);
			if (index !== -1) {
				skills.push(skills.splice(index, 1)[0]);
				renderSkills();
			}
		}
	}

	const parentSkill = findParentSkill(skill.id);
	if (parentSkill) {
		updateSkillProgress(parentSkill);
	}
}

function updateOverallProgress() {
	const totalTasks = skills.reduce(
		(sum, skill) => sum + calculateTotalTasks(skill),
		0,
	);
	const completedTasks = skills.reduce(
		(sum, skill) => sum + calculateCompletedTasks(skill),
		0,
	);
	const progress = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
	overallProgress = document.querySelector("#overallProgress .progress-bar");
	overallProgress.style.width = `${progress}%`;
}

function formatDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isSameLevel(elem1, elem2) {
	return elem1.parentNode === elem2.parentNode;
}

function setupDragAndDrop(Element, container, parentSkill, type) {
	let draggedElement = Element;
	draggedElement.style.opacity = "0.5";

	const mouseMoveHandler = (e) => {
		const hoverElement = e.target.closest(`.${type}`);
		if (
			hoverElement &&
			hoverElement !== draggedElement &&
			hoverElement.parentNode === container
		) {
			const rect = hoverElement.getBoundingClientRect();
			const hoverMiddleX = (rect.right - rect.left) / 2;
			const hoverMiddleY = (rect.bottom - rect.top) / 2;

			const isLeft = e.clientX < rect.left + hoverMiddleX;
			const isAbove = e.clientY < rect.top + hoverMiddleY;

			if (isLeft && isAbove) {
				container.insertBefore(draggedElement, hoverElement);
			} else if (isLeft && !isAbove) {
				container.insertBefore(draggedElement, hoverElement.nextSibling);
			} else if (!isLeft && isAbove) {
				container.insertBefore(draggedElement, hoverElement);
			} else {
				container.insertBefore(draggedElement, hoverElement.nextSibling);
			}
		}
	};

	const mouseUpHandler = () => {
		draggedElement.style.opacity = "1";
		document.removeEventListener("mousemove", mouseMoveHandler);
		document.removeEventListener("mouseup", mouseUpHandler);
		updateOrder(parentSkill, container, type);
	};

	document.addEventListener("mousemove", mouseMoveHandler);
	document.addEventListener("mouseup", mouseUpHandler);
}

function updateOrder(parentSkill, container, type) {
	const elements = container.querySelectorAll(`.${type}`);

	if (parentSkill) {
		if (type === "task") {
			parentSkill.tasks = Array.from(elements)
				.map((el) => {
					const taskId = parseInt(el.dataset.taskId);
					return parentSkill.tasks.find((task) => task.id === taskId);
				})
				.filter(task => task !== null && task !== undefined);

		} else {
			parentSkill.skills = Array.from(elements)
				.map((el) => {
					const skillId = parseInt(el.id.split("-")[1]);
					return parentSkill.skills.find((subskill) => subskill.id === skillId);
				})
				.filter(skill => skill !== null && skill !== undefined);
		}
	} else {
		skills = Array.from(elements)
			.map((el) => {
				const skillId = parseInt(el.id.split("-")[1]);
				return skills.find((skill) => skill.id === skillId);
			})
			.filter(skill => skill !== null && skill !== undefined);
	}

	saveData();
}

function renderCalendar() {
	const calendarHeader = document.getElementById("calendarHeader");
	const calendar = document.getElementById("calendar");
	calendar.innerHTML = "";
	calendarHeader.innerHTML = "";

	const createButton = (text, action) => {
		const button = document.createElement("button");
		button.textContent = text;
		button.addEventListener("click", action);
		return button;
	};

	calendarHeader.appendChild(
		createButton("<<", () => {
			currentDate.setMonth(currentDate.getMonth() - 1);
			renderCalendar();
		}),
	);

	selectedDate = selectedDate || currentDate;

	const selectedDateDisplay = document.createElement("h2");
	selectedDateDisplay.id = "currentDateDisplay";
	selectedDateDisplay.textContent = currentDate.toLocaleString("default", {
		month: "long",
		year: "numeric",
	});
	calendarHeader.appendChild(selectedDateDisplay);

	calendarHeader.appendChild(
		createButton(">>", () => {
			currentDate.setMonth(currentDate.getMonth() + 1);
			renderCalendar();
		}),
	);

	const daysInMonth = new Date(
		currentDate.getFullYear(),
		currentDate.getMonth() + 1,
		0,
	).getDate();
	const firstDay = new Date(
		currentDate.getFullYear(),
		currentDate.getMonth(),
		1,
	).getDay();
	const today = new Date();

	const createDayElement = (day) => {
		const dayElement = document.createElement("div");
		dayElement.className = "calendar-day";
		dayElement.textContent = day;

		const date = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			day,
		);
		const hoursWorked = calculateHoursWorked(date);
		const maxHours = 12;
		const normalizedHours = Math.min(hoursWorked / maxHours, 1);

		const hue = 250 * normalizedHours;
		const saturation = 30;

		const isDarkMode = document.body.classList.contains("dark-mode");
		const lightness = isDarkMode ? 25 * 1.5 : 25 * 2.5;

		dayElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

		if (date.toDateString() === today.toDateString()) {
			dayElement.classList.add("current-day");
		}

		if (date.toDateString() === selectedDate.toDateString()) {
			dayElement.classList.add("selected-day");
		}

		dayElement.addEventListener("click", () => {
			selectedDate = date;
			renderCalendar();
			updateRightPanel(date);
		});

		return dayElement;
	};

	calendar.append(
		...Array(firstDay)
			.fill()
			.map(() => {
				const emptyDay = document.createElement("div");
				emptyDay.className = "calendar-day empty";
				return emptyDay;
			}),
		...Array(daysInMonth)
			.fill()
			.map((_, index) => createDayElement(index + 1)),
	);

	updateRightPanel(selectedDate);
}

function calculateHoursWorked(date) {
	return hoursWorkedDict[formatDate(date)] || 0;
}

function calculateExerciseHours(date) {
	return exerciseHoursDict[formatDate(date)] || 0;
}

function updateRightPanel(date) {
	const selectedDate = document.getElementById("selectedDate");
	const learningHoursSpent = document.getElementById("learningHoursSpent");
	const exerciseHours = document
		.getElementById("exerciseHours")
		.querySelector(".hours-input");
	const taskList = document.getElementById("taskList");

	selectedDate.textContent = date.toDateString();
	learningHoursSpent.textContent = calculateHoursWorked(date);
	exerciseHours.value = calculateExerciseHours(date);

	const tasks = getTasksForDate(date);
	const plannedTasks = getPlannedTasksForDate(date);

	taskList.innerHTML = "";

	if (plannedTasks.length > 0) {
		// Show planned tasks with color coding
		plannedTasks.forEach(task => {
			const li = document.createElement("li");
			li.textContent = task.name;
			li.className = task.completed ? "task-completed" : "task-uncompleted";
			taskList.appendChild(li);
		});
	} else if (tasks.length > 0) {
		// Show completed tasks when no planned tasks
		taskList.innerHTML = tasks.map((task) => `<li class="task-completed">${task.name}</li>`).join("");
	} else {
		taskList.innerHTML = "No tasks for this day.";
	}
}

function getTasksForDate(date) {
	return skills.flatMap((skill) =>
		getAllTasksFromSkill(skill).filter(
			(task) =>
				task.completed &&
				new Date(task.date).toDateString() === date.toDateString(),
		),
	);
}

function getPlannedTasksForDate(date) {
	const dateStr = formatDate(date);
	return skills.flatMap((skill) =>
		getAllTasksFromSkill(skill).filter(
			(task) => task.planned && task.plannedDate === dateStr
		),
	);
}

function getAllTasksFromSkill(skill) {
	let tasks = [...skill.tasks];
	if (skill.skills && skill.skills.length > 0) {
		skill.skills.forEach((subskill) => {
			tasks = tasks.concat(getAllTasksFromSkill(subskill));
		});
	}
	return tasks;
}

function renderChart() {
	const chartPage = document.getElementById("chartPage");
	chartPage.innerHTML = "";

	const chartTitle = document.createElement("h2");
	chartTitle.id = "chartTitle";
	chartPage.appendChild(chartTitle);

	const buttonContainer = document.createElement("div");
	buttonContainer.id = "buttonContainer";
	chartPage.appendChild(buttonContainer);

	const createButton = (text, action) => {
		const button = document.createElement("button");
		button.textContent = text;
		button.addEventListener("click", action);
		return button;
	};

	let currentView = "week";
	let currentStartDate = new Date(currentDate);
	currentStartDate.setDate(
		currentStartDate.getDate() - currentStartDate.getDay(),
	);
	const updateChart = () => {
		const endDate = new Date(currentStartDate);
		let days, title, labels;

		switch (currentView) {
			case "week":
				days = 7;
				endDate.setDate(endDate.getDate() + 6);
				title = `Week of ${currentStartDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
				labels = Array.from({ length: 7 }, (_, i) => {
					const date = new Date(currentStartDate);
					date.setDate(date.getDate() + i);
					return date.toLocaleDateString("en-US", { weekday: "short" });
				});
				break;
			case "month":
				days = new Date(
					currentStartDate.getFullYear(),
					currentStartDate.getMonth() + 1,
					0,
				).getDate();
				endDate.setMonth(endDate.getMonth() + 1);
				endDate.setDate(0);
				title = currentStartDate.toLocaleString("default", {
					month: "long",
					year: "numeric",
				});
				labels = Array.from({ length: days }, (_, i) => i + 1);
				break;
			case "year":
				days = 365;
				endDate.setFullYear(endDate.getFullYear() + 1);
				endDate.setDate(0);
				title = currentStartDate.getFullYear().toString();
				labels = Array.from({ length: 365 }, (_, i) => {
					const date = new Date(title, 0, i + 1);
					return date.toLocaleDateString("default", {
						month: "short",
						day: "numeric",
					});
				});
				break;
		}

		chartTitle.textContent = title;

		const hoursWorkedData = [];
		const exerciseHoursData = [];
		let maxHours = 12;

		for (let i = 0; i < days; i++) {
			const date = new Date(currentStartDate);
			date.setDate(date.getDate() + i);

			const workedHours = calculateHoursWorked(date);
			const exerciseHours = calculateExerciseHours(date);

			hoursWorkedData.push(workedHours);
			exerciseHoursData.push(exerciseHours);

			maxHours = Math.max(maxHours, workedHours + exerciseHours);
		}

		const chartContainer = document.getElementById("chartContainer");
		chartContainer.innerHTML = "";
		const canvas = document.createElement("canvas");
		chartContainer.appendChild(canvas);

		const ctx = canvas.getContext("2d");
		const chart = new Chart(ctx, {
			type: "bar",
			data: {
				labels: labels,
				datasets: [
					{
						label: "Worked Hours",
						data: hoursWorkedData,
						backgroundColor: hoursWorkedData.map((d) => {
							const normalizedHours = Math.min(d / maxHours, 1);
							const hue = 250 * normalizedHours;
							const saturation = 30;
							const lightness = 25 * (currentTheme === "light" ? 2.5 : 1);
							return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
						}),
						barPercentage: 1,
						categoryPercentage: 1,
					},
					{
						label: "Exercise Hours",
						data: exerciseHoursData,
						backgroundColor: exerciseHoursData.map(() => {
							const gradient = ctx.createLinearGradient(0, 0, 0, 400);
							gradient.addColorStop(0, "rgba(211, 211, 211, 0.8)");
							gradient.addColorStop(0.5, "rgba(211, 211, 211, 0.5)");
							gradient.addColorStop(1, "rgba(211, 211, 211, 0.2)");
							return gradient;
						}),
						barPercentage: 1,
						categoryPercentage: 1,
						hoverBackgroundColor: "rgba(211, 211, 211, 0.6)",
						hoverBorderColor: "rgba(128, 128, 128, 0.9)",
						hoverBorderWidth: 1.5,
						barThickness: "flex",
						borderSkipped: false,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						stacked: true,
					},
					y: {
						stacked: true,
						beginAtZero: true,
						max: maxHours,
					},
				},
				animation: {
					duration: 1000,
					easing: "easeOutQuart",
				},
				plugins: {
					legend: {
						display: true,
					},
				},
			},
		});
	};

	buttonContainer.appendChild(
		createButton("<<", () => {
			switch (currentView) {
				case "week":
					currentStartDate.setDate(currentStartDate.getDate() - 7);
					break;
				case "month":
					currentStartDate.setMonth(currentStartDate.getMonth() - 1);
					break;
				case "year":
					currentStartDate.setFullYear(currentStartDate.getFullYear() - 1);
					break;
			}
			updateChart();
		}),
	);

	["Week", "Month", "Year"].forEach((view) => {
		const button = createButton(view, () => {
			currentView = view.toLowerCase();
			currentStartDate = new Date(selectedDate);
			if (currentView === "week") {
				currentStartDate = new Date(currentDate);
				currentStartDate.setDate(
					currentStartDate.getDate() - currentStartDate.getDay(),
				);
			} else if (currentView === "month") {
				currentStartDate.setDate(1);
			} else if (currentView === "year") {
				currentStartDate.setMonth(0, 1);
			}
			updateChart();
		});
		buttonContainer.appendChild(button);
	});

	buttonContainer.appendChild(
		createButton(">>", () => {
			switch (currentView) {
				case "week":
					currentStartDate.setDate(currentStartDate.getDate() + 7);
					break;
				case "month":
					currentStartDate.setMonth(currentStartDate.getMonth() + 1);
					break;
				case "year":
					currentStartDate.setFullYear(currentStartDate.getFullYear() + 1);
					break;
			}
			updateChart();
		}),
	);

	const chartContainer = document.createElement("div");
	chartContainer.id = "chartContainer";
	chartPage.appendChild(chartContainer);

	updateChart();
}

function saveData() {
	const cleanedSkills = cleanSkillsData(skills);

	const data = {
		currentTheme,
		skills: cleanedSkills,
		hoursWorkedDict,
		exerciseHoursDict,
		selectedDate: selectedDate ? selectedDate.toISOString() : null,
	};

	console.log("Saving data:", data);
	window.electronAPI.saveData("ProgressoData", data);
}

window.electronAPI.onAppQuitting(() => {
	saveData();
});

window.addEventListener("beforeunload", () => {
	saveData();
});
