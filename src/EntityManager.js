export default class EntityManager {
  constructor() {
    this.ids = 0;
    this.entities = {};
    this.globalEventHandlers = [];
  }
  Get(name) {
    return Object.values(this.entities).find((el) => el.Name === name);
  }

  Add(entity) {
    if (!entity.Name) {
      entity.SetName(this.ids);
    }
    entity.id = this.ids;
    this.ids++;
    entity.SetParent(this);
    this.entities[entity.id] = entity;
  }

  Remove(entity) {
    if (entity.id in this.entities) {
      delete this.entities[entity.id];
    }
  }

  RegisterGlobalEventHandler(handler) {
    this.globalEventHandlers.push(handler);
  }

  BroadcastGlobalEvent(eventData) {
    for (const handler of this.globalEventHandlers) {
      handler(eventData);
    }
  }
  EndSetup() {
    for (const ent of Object.values(this.entities)) {
      for (const key in ent.components) {
        ent.components[key].Initialize();
      }
    }
  }

  PhysicsUpdate(world, timeStep) {
    for (const entity of Object.values(this.entities)) {
      entity.PhysicsUpdate(world, timeStep);
    }
  }

  Update(timeElapsed) {
    for (const entity of Object.values(this.entities)) {
      entity.Update(timeElapsed);
    }
  }
}
