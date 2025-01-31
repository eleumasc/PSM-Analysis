import { DomainModel } from "../core/DataAccessObject";
import { Maybe } from "./Maybe";

export default function filterTestDomain(
  testDomainName: Maybe<string>,
  domains: DomainModel[]
): DomainModel[] {
  if (!testDomainName) {
    return domains;
  }
  return domains.filter((domainModel) => domainModel.name === testDomainName);
}
